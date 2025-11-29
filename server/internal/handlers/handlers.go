package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"e2ee-messenger/server/internal/config"
	"e2ee-messenger/server/internal/database"
	"e2ee-messenger/server/internal/middleware"
	"e2ee-messenger/server/internal/models"
	"e2ee-messenger/server/internal/websocket"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	db  *database.DB
	hub *websocket.Hub
	cfg *config.Config
}

// New creates a new handlers instance
func New(db *database.DB, hub *websocket.Hub, cfg *config.Config) *Handlers {
	return &Handlers{
		db:  db,
		hub: hub,
		cfg: cfg,
	}
}

// respondWithError is a helper to send a JSON error response.
func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}

// Signup handles user registration
func (h *Handlers) Signup(w http.ResponseWriter, r *http.Request) {
	var req models.SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Check if user already exists
	var existingUser models.User
	err := h.db.QueryRow("SELECT id FROM users WHERE email = $1 OR username = $2", req.Email, req.Username).Scan(&existingUser.ID)
	if err == nil {
		respondWithError(w, http.StatusConflict, "A user with this email or username already exists")
		return
	}

	// Hash password
	hashedPassword := hashPassword(req.Password)

	// Create user
	user := models.User{
		ID:        uuid.New(),
		Username:  req.Username,
		Email:     req.Email,
		Password:  hashedPassword,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = h.db.Exec(`
		INSERT INTO users (id, username, email, password, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, user.ID, user.Username, user.Email, user.Password, user.CreatedAt, user.UpdatedAt)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Generate JWT token
	token, err := h.generateToken(user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	response := models.AuthResponse{
		Token:    token,
		User:     user,
		DeviceID: uuid.New().String(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Login handles user authentication
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Find user
	var user models.User
	err := h.db.QueryRow(`
		SELECT id, username, email, password, avatar_url, created_at, updated_at
		FROM users WHERE email = $1
	`, req.Email).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Verify password
	if !verifyPassword(req.Password, user.Password) {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Generate JWT token
	token, err := h.generateToken(user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	response := models.AuthResponse{
		Token:    token,
		User:     user,
		DeviceID: uuid.New().String(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateProfile handles updating the current user's profile
func (h *Handlers) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Check if the new username is already taken by another user
	var existingUserID uuid.UUID
	err := h.db.QueryRow("SELECT id FROM users WHERE username = $1 AND id != $2", req.Username, userID).Scan(&existingUserID)
	if err != nil && err != sql.ErrNoRows {
		respondWithError(w, http.StatusInternalServerError, "Database error while checking username")
		return
	}
	if err == nil {
		respondWithError(w, http.StatusConflict, "This username is already taken")
		return
	}

	// Update user in the database
	var updatedUser models.User
	err = h.db.QueryRow(`
		UPDATE users 
		SET username = $1, updated_at = $2 
		WHERE id = $3
		RETURNING id, username, email, password, avatar_url, created_at, updated_at
	`, req.Username, time.Now(), userID).Scan(
		&updatedUser.ID, &updatedUser.Username, &updatedUser.Email, &updatedUser.Password, &updatedUser.AvatarURL, &updatedUser.CreatedAt, &updatedUser.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "User not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update user profile")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedUser)
}

// UploadAvatar handles uploading a new profile picture for the current user
func (h *Handlers) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	// 1. Parse the multipart form data (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondWithError(w, http.StatusBadRequest, "File too large")
		return
	}

	// 2. Get the file from the form
	file, handler, err := r.FormFile("avatar")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file upload")
		return
	}
	defer file.Close()

	// 3. Create the uploads directory if it doesn't exist
	uploadsDir := "./uploads"
	if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
		os.Mkdir(uploadsDir, 0755)
	}

	// 4. Create a unique filename and destination file
	ext := filepath.Ext(handler.Filename)
	if ext == "" {
		ext = ".jpg" // Default extension
	}
	fileName := fmt.Sprintf("%s%s", userID.String(), ext)
	dstPath := filepath.Join(uploadsDir, fileName)
	dst, err := os.Create(dstPath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer dst.Close()

	// 5. Copy the uploaded file to the destination
	if _, err := io.Copy(dst, file); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file content")
		return
	}

	// 6. Update the user's avatar_url in the database
	avatarURL := fmt.Sprintf("/uploads/%s", fileName)
	_, err = h.db.Exec("UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3", avatarURL, time.Now(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update user profile")
		return
	}

	// 7. Respond with the new URL
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"avatar_url": avatarURL})
}

// ChangePassword handles updating the current user's password
func (h *Handlers) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// 1. Fetch current user to get their current hashed password
	var currentUser models.User
	err := h.db.QueryRow("SELECT password FROM users WHERE id = $1", userID).Scan(&currentUser.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve user data")
		return
	}

	// 2. Verify the old password
	if !verifyPassword(req.OldPassword, currentUser.Password) {
		respondWithError(w, http.StatusUnauthorized, "Incorrect current password")
		return
	}

	// 3. Hash the new password
	newHashedPassword := hashPassword(req.NewPassword)

	// 4. Update the password in the database
	_, err = h.db.Exec("UPDATE users SET password = $1, updated_at = $2 WHERE id = $3", newHashedPassword, time.Now(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteAccount handles the permanent deletion of a user's account
func (h *Handlers) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	// The ON DELETE CASCADE constraint on the users table should handle
	// deleting all related data (messages, keys, group memberships, etc.)
	_, err := h.db.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		log.Printf("Failed to delete user account %s: %v", userID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete account")
		return
	}

	log.Printf("User account %s deleted successfully", userID)

	// 204 No Content is appropriate for a successful deletion with no response body
	w.WriteHeader(http.StatusNoContent)
}

// GetUsers returns a list of all users, excluding the current user
func (h *Handlers) GetUsers(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	rows, err := h.db.Query(`
		SELECT id, username, email, avatar_url, created_at, updated_at
		FROM users
		WHERE id != $1
		ORDER BY username ASC
	`, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var avatarURL sql.NullString
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &avatarURL, &user.CreatedAt, &user.UpdatedAt); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan user")
			return
		}
		if avatarURL.Valid {
			user.AvatarURL = avatarURL.String
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetChats returns a list of chats for the current user
func (h *Handlers) GetChats(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	// This query is now much more complex. It combines Direct Messages and Group Chats.
	query := `
	WITH all_chats AS (
		-- 1. Get Direct Message (DM) chats
		SELECT
			'dm' AS chat_type,
			CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS chat_id,
			m.created_at AS last_message_at,
			m.id AS message_id,
			m.encrypted_content,
			m.message_type
		FROM messages m
		WHERE m.group_id IS NULL AND (m.sender_id = $1 OR m.recipient_id = $1)

		UNION ALL

		-- 2. Get Group chats
		SELECT
			'group' AS chat_type,
			gm.group_id AS chat_id,
			m.created_at AS last_message_at,
			m.id AS message_id,
			m.encrypted_content,
			m.message_type
		FROM group_members gm
		LEFT JOIN messages m ON gm.group_id = m.group_id
		WHERE gm.user_id = $1
	),
	latest_chats AS (
		SELECT
			DISTINCT ON (chat_id)
			chat_type,
			chat_id,
			last_message_at,
			message_id,
			encrypted_content,
			message_type
		FROM all_chats
		ORDER BY chat_id, last_message_at DESC
	)
	SELECT
		lc.chat_type,
		lc.chat_id,
		COALESCE(lc.last_message_at, '1970-01-01T00:00:00Z') as last_message_at,
		u.id AS participant_id,
		u.username AS participant_username,
		u.avatar_url AS participant_avatar_url,
		g.id AS group_id,
		g.name AS group_name,
		(SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as participant_count,
		lc.message_id,
		lc.encrypted_content,
		lc.message_type
	FROM latest_chats lc
	LEFT JOIN users u ON lc.chat_type = 'dm' AND lc.chat_id = u.id
	LEFT JOIN groups g ON lc.chat_type = 'group' AND lc.chat_id = g.id
	ORDER BY last_message_at DESC;
	`

	rows, err := h.db.Query(query, userID)
	if err != nil {
		log.Printf("Error fetching chats: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch chats")
		return
	}
	defer rows.Close()

	var chats []models.Chat
	for rows.Next() {
		var chat models.Chat
		var chatType string
		var chatID uuid.UUID
		var lastMessageAt time.Time
		var participantID, groupID, messageID sql.NullString
		var participantUsername, participantAvatarURL, groupName, encryptedContent, messageType sql.NullString
		var participantCount sql.NullInt64

		err := rows.Scan(
			&chatType, &chatID, &lastMessageAt,
			&participantID, &participantUsername, &participantAvatarURL,
			&groupID, &groupName, &participantCount,
			&messageID, &encryptedContent, &messageType,
		)
		if err != nil {
			log.Printf("Error scanning chat row: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to scan chat")
			return
		}

		chat.Type = chatType
		chat.ID = chatID.String()
		chat.UpdatedAt = lastMessageAt
		chat.UnreadCount = 0

		if chatType == "dm" && participantID.Valid {
			chat.Name = participantUsername.String
			chat.Participant = &models.User{
				ID:        uuid.MustParse(participantID.String),
				Username:  participantUsername.String,
				AvatarURL: participantAvatarURL.String,
			}
		} else if chatType == "group" && groupID.Valid {
			chat.Name = groupName.String
			chat.ParticipantCount = int(participantCount.Int64)
		}

		if messageID.Valid {
			chat.LastMessage = &models.Message{
				ID:               uuid.MustParse(messageID.String),
				EncryptedContent: encryptedContent.String,
				MessageType:      messageType.String,
				CreatedAt:        lastMessageAt,
			}
		}

		chats = append(chats, chat)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error after iterating chat rows: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error processing chat list")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chats)
}

// UploadDeviceKey handles device key upload
func (h *Handlers) UploadDeviceKey(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.DeviceKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	deviceKey := models.DeviceKey{
		ID:        uuid.New(),
		UserID:    userID,
		DeviceID:  req.DeviceID,
		PublicKey: req.PublicKey,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := h.db.Exec(`
		INSERT INTO device_keys (id, user_id, device_id, public_key, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, device_id) 
		DO UPDATE SET public_key = $4, updated_at = $6
	`, deviceKey.ID, deviceKey.UserID, deviceKey.DeviceID, deviceKey.PublicKey, deviceKey.CreatedAt, deviceKey.UpdatedAt)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to upload device key")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(deviceKey)
}

// UploadOneTimeKey handles one-time key upload
func (h *Handlers) UploadOneTimeKey(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.OneTimeKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	oneTimeKey := models.OneTimeKey{
		ID:        uuid.New(),
		UserID:    userID,
		KeyID:     req.KeyID,
		PublicKey: req.PublicKey,
		Used:      false,
		CreatedAt: time.Now(),
	}

	_, err := h.db.Exec(`
		INSERT INTO one_time_keys (id, user_id, key_id, public_key, used, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, key_id) 
		DO UPDATE SET public_key = $4, used = $5
	`, oneTimeKey.ID, oneTimeKey.UserID, oneTimeKey.KeyID, oneTimeKey.PublicKey, oneTimeKey.Used, oneTimeKey.CreatedAt)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to upload one-time key")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(oneTimeKey)
}

// GetBootstrapKeys returns device and one-time keys for a user
func (h *Handlers) GetBootstrapKeys(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "user_id parameter required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user_id format")
		return
	}

	// Get device keys
	deviceRows, err := h.db.Query(`
		SELECT id, user_id, device_id, public_key, created_at, updated_at
		FROM device_keys WHERE user_id = $1
	`, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch device keys")
		return
	}
	defer deviceRows.Close()

	var deviceKeys []models.DeviceKey
	for deviceRows.Next() {
		var key models.DeviceKey
		err := deviceRows.Scan(&key.ID, &key.UserID, &key.DeviceID, &key.PublicKey, &key.CreatedAt, &key.UpdatedAt)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan device key")
			return
		}
		deviceKeys = append(deviceKeys, key)
	}

	// Get unused one-time keys (limit to 10)
	oneTimeRows, err := h.db.Query(`
		SELECT id, user_id, key_id, public_key, used, created_at
		FROM one_time_keys WHERE user_id = $1 AND used = false
		ORDER BY created_at ASC LIMIT 10
	`, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch one-time keys")
		return
	}
	defer oneTimeRows.Close()

	var oneTimeKeys []models.OneTimeKey
	for oneTimeRows.Next() {
		var key models.OneTimeKey
		err := oneTimeRows.Scan(&key.ID, &key.UserID, &key.KeyID, &key.PublicKey, &key.Used, &key.CreatedAt)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan one-time key")
			return
		}
		oneTimeKeys = append(oneTimeKeys, key)
	}

	response := models.BootstrapKeysResponse{
		DeviceKeys:  deviceKeys,
		OneTimeKeys: oneTimeKeys,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// SendMessage handles message sending
func (h *Handlers) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// A message must have either a recipient or a group
	if req.RecipientID == nil && req.GroupID == nil {
		respondWithError(w, http.StatusBadRequest, "Message must have a recipient_id or a group_id")
		return
	}

	message := models.Message{
		ID:               uuid.New(),
		SenderID:         userID,
		EncryptedContent: req.EncryptedContent,
		MessageType:      req.MessageType,
		CreatedAt:        time.Now(),
	}

	if req.GroupID != nil {
		// This is a group message
		groupID, err := uuid.Parse(*req.GroupID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid group_id format")
			return
		}
		message.GroupID = &groupID

		// Verify the sender is a member of the group
		var memberCount int
		err = h.db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2", groupID, userID).Scan(&memberCount)
		if err != nil || memberCount == 0 {
			respondWithError(w, http.StatusForbidden, "You are not a member of this group")
			return
		}

		// Insert group message into DB
		_, err = h.db.Exec(`
			INSERT INTO messages (id, sender_id, group_id, encrypted_content, message_type, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, message.ID, message.SenderID, message.GroupID, message.EncryptedContent, message.MessageType, message.CreatedAt)
		if err != nil {
			log.Printf("Database error on group message insert: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to send group message")
			return
		}

		// Get all members of the group to notify them
		rows, err := h.db.Query("SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2", groupID, userID)
		if err != nil {
			log.Printf("Failed to get group members for notification: %v", err)
		} else {
			defer rows.Close()
			notification := websocket.Message{Type: "new_message", Payload: message}
			for rows.Next() {
				var memberID string
				if err := rows.Scan(&memberID); err == nil {
					h.hub.SendToUser(memberID, notification)
				}
			}
		}

	} else {
		// This is a direct message
		recipientID, err := uuid.Parse(*req.RecipientID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid recipient_id format")
			return
		}
		message.RecipientID = &recipientID

		// Insert direct message into DB
		_, err = h.db.Exec(`
			INSERT INTO messages (id, sender_id, recipient_id, encrypted_content, message_type, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, message.ID, message.SenderID, message.RecipientID, message.EncryptedContent, message.MessageType, message.CreatedAt)

		if err != nil {
			log.Printf("Database error on message insert: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to send message")
			return
		}

		// Send real-time notification to recipient
		notification := websocket.Message{
			Type:    "new_message",
			Payload: message,
		}
		h.hub.SendToUser(recipientID.String(), notification)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(message)
}

// GetMessages handles message retrieval
func (h *Handlers) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	// Get query parameters
	recipientIDStr := r.URL.Query().Get("recipient_id")
	groupIDStr := r.URL.Query().Get("group_id")
	limitStr := r.URL.Query().Get("limit")

	// Set default limit
	limit := 50 // default limit

	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	var query string
	var args []interface{}

	if groupIDStr != "" {
		// Fetching messages for a group
		groupID, err := uuid.Parse(groupIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid group_id format")
			return
		}
		// TODO: Verify user is a member of the group before fetching messages
		query = `
			SELECT sub.id, sub.sender_id, sub.group_id, sub.encrypted_content, sub.message_type, sub.created_at, u.id, u.username, u.avatar_url FROM (
				SELECT id, sender_id, group_id, encrypted_content, message_type, created_at
				FROM messages
				WHERE group_id = $1
				ORDER BY created_at DESC
				LIMIT $2
			) sub
			JOIN users u ON sub.sender_id = u.id
			ORDER BY sub.created_at ASC;
		`
		args = []interface{}{groupID, limit}

	} else if recipientIDStr != "" {
		// Fetching messages for a DM
		recipientID, err := uuid.Parse(recipientIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid recipient_id format")
			return
		}
		query = `
			SELECT id, sender_id, recipient_id, encrypted_content, message_type, created_at FROM (
				SELECT id, sender_id, recipient_id, encrypted_content, message_type, created_at
				FROM messages 
				WHERE ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1))
				ORDER BY created_at DESC
				LIMIT $3
			) sub
			ORDER BY created_at ASC;
		`
		args = []interface{}{userID, recipientID, limit}

	} else {
		respondWithError(w, http.StatusBadRequest, "Either recipient_id or group_id parameter is required")
		return
	}

	rows, err := h.db.Query(query, args...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch messages")
		return
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var message models.Message
		if groupIDStr != "" {
			var sender models.User
			var avatarURL sql.NullString
			err = rows.Scan(&message.ID, &message.SenderID, &message.GroupID, &message.EncryptedContent, &message.MessageType, &message.CreatedAt, &sender.ID, &sender.Username, &avatarURL)
			if avatarURL.Valid {
				sender.AvatarURL = avatarURL.String
			}
			message.Sender = &sender
		} else {
			err = rows.Scan(&message.ID, &message.SenderID, &message.RecipientID, &message.EncryptedContent, &message.MessageType, &message.CreatedAt)
		}

		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan message")
			return
		}
		messages = append(messages, message)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// SendReceipt handles message receipt sending
func (h *Handlers) SendReceipt(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.SendReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	messageID, err := uuid.Parse(req.MessageID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid message_id format")
		return
	}

	receipt := models.Receipt{
		ID:        uuid.New(),
		MessageID: messageID,
		UserID:    userID,
		Type:      req.Type,
		CreatedAt: time.Now(),
	}

	_, err = h.db.Exec(`
		INSERT INTO receipts (id, message_id, user_id, type, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (message_id, user_id, type) DO NOTHING
	`, receipt.ID, receipt.MessageID, receipt.UserID, receipt.Type, receipt.CreatedAt)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to send receipt")
		return
	}

	// Send real-time notification to sender
	notification := map[string]interface{}{
		"type": "message_receipt",
		"payload": map[string]interface{}{
			"message_id": messageID,
			"user_id":    userID,
			"type":       req.Type,
			"created_at": receipt.CreatedAt,
		},
	}

	// Get sender ID from message
	var senderID uuid.UUID
	err = h.db.QueryRow("SELECT sender_id FROM messages WHERE id = $1", messageID).Scan(&senderID)
	if err == nil {
		h.hub.SendToUser(senderID.String(), notification)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(receipt)
}

// CreateGroup handles the creation of a new group chat
func (h *Handlers) CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	var req models.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Start a database transaction
	tx, err := h.db.Begin()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to start database transaction")
		return
	}
	// Defer a rollback in case of error, commit will override this if successful
	defer tx.Rollback()

	// 1. Create the group
	group := models.Group{
		ID:        uuid.New(),
		Name:      req.Name,
		CreatedBy: userID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = tx.Exec(`
		INSERT INTO groups (id, name, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`, group.ID, group.Name, group.CreatedBy, group.CreatedAt, group.UpdatedAt)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create group")
		return
	}

	// 2. Add the creator as an admin member
	_, err = tx.Exec(`
		INSERT INTO group_members (group_id, user_id, role)
		VALUES ($1, $2, 'admin')
	`, group.ID, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to add creator to group")
		return
	}

	// 3. Add the other members
	stmt, err := tx.Prepare("INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to prepare member insertion")
		return
	}
	defer stmt.Close()

	for _, memberIDStr := range req.MemberIDs {
		memberID, err := uuid.Parse(memberIDStr)
		if err != nil {
			// Skip invalid UUIDs
			continue
		}
		if _, err := stmt.Exec(group.ID, memberID); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to add member to group")
			return
		}
	}

	// If all went well, commit the transaction
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(group)
}

// UploadAttachment handles uploading a file attachment for a message
func (h *Handlers) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	// 1. Parse the multipart form data (max 50MB for files)
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondWithError(w, http.StatusBadRequest, "File too large (max 50MB)")
		return
	}

	// 2. Get the file from the form
	file, handler, err := r.FormFile("attachment")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file upload. 'attachment' field missing.")
		return
	}
	defer file.Close()

	// 3. Get other form fields
	messageIDStr := r.FormValue("message_id")
	encryptedKey := r.FormValue("encrypted_key")
	if messageIDStr == "" || encryptedKey == "" {
		respondWithError(w, http.StatusBadRequest, "message_id and encrypted_key are required")
		return
	}

	messageID, err := uuid.Parse(messageIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid message_id format")
		return
	}

	// Verify that the user has permission to attach a file to this message
	// (e.g., they are the sender of the message).
	var senderID uuid.UUID
	err = h.db.QueryRow("SELECT sender_id FROM messages WHERE id = $1", messageID).Scan(&senderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Message not found")
		return
	}
	if senderID != userID {
		respondWithError(w, http.StatusForbidden, "You are not authorized to attach a file to this message")
		return
	}

	// 4. Create a unique path and save the file
	uploadsDir := "./uploads/attachments"
	if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
		os.MkdirAll(uploadsDir, 0755)
	}

	// Use message ID for folder to keep attachments organized
	attachmentDir := filepath.Join(uploadsDir, messageID.String())
	os.MkdirAll(attachmentDir, 0755)
	dstPath := filepath.Join(attachmentDir, handler.Filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file content")
		return
	}

	// 5. Create the attachment record in the database
	_, err = h.db.Exec(`
		INSERT INTO attachments (message_id, file_name, file_size, mime_type, storage_path, encrypted_key)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, messageID, handler.Filename, handler.Size, handler.Header.Get("Content-Type"), dstPath, encryptedKey)
	if err != nil {
		log.Printf("Failed to create attachment record: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create attachment record")
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// DownloadAttachment serves a file for download
func (h *Handlers) DownloadAttachment(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	messageIDStr := chi.URLParam(r, "messageID")
	fileName := chi.URLParam(r, "fileName")

	if messageIDStr == "" || fileName == "" {
		respondWithError(w, http.StatusBadRequest, "messageID and fileName are required")
		return
	}

	messageID, err := uuid.Parse(messageIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid messageID format")
		return
	}

	// 1. Fetch attachment details and message participants from DB
	var storagePath, mimeType string
	var senderID, recipientID, groupID sql.NullString // Use sql.NullString for nullable UUIDs

	err = h.db.QueryRow(`
		SELECT a.storage_path, a.mime_type, m.sender_id, m.recipient_id, m.group_id
		FROM attachments a
		JOIN messages m ON a.message_id = m.id
		WHERE a.message_id = $1 AND a.file_name = $2
	`, messageID, fileName).Scan(&storagePath, &mimeType, &senderID, &recipientID, &groupID)

	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusNotFound, "Attachment not found")
		return
	}
	if err != nil {
		log.Printf("Error fetching attachment details: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve attachment")
		return
	}

	// 2. Authorization Check: Verify the user is part of the conversation
	isAuthorized := false
	if groupID.Valid { // Group Message
		var memberCount int
		err = h.db.QueryRow("SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND user_id = $2", groupID.String, userID).Scan(&memberCount)
		if err == nil && memberCount > 0 {
			isAuthorized = true
		}
	} else if senderID.Valid && recipientID.Valid { // Direct Message
		if senderID.String == userID.String() || recipientID.String == userID.String() {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		respondWithError(w, http.StatusForbidden, "You are not authorized to download this attachment")
		return
	}

	// 3. Serve the file
	// Set headers to prompt download
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	w.Header().Set("Content-Type", mimeType)

	// Check if file exists before serving
	if _, err := os.Stat(storagePath); os.IsNotExist(err) {
		respondWithError(w, http.StatusNotFound, "File not found on server")
		return
	}

	http.ServeFile(w, r, storagePath)
}

// WebSocketHandler handles WebSocket connections
func (h *Handlers) WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	websocket.ServeWS(h.hub, w, r, userID.String())
}

// Helper functions

func (h *Handlers) generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

func hashPassword(password string) string {
	// Using Argon2id for password hashing
	salt := []byte("random-salt-change-in-production") // In production, use random salt per user
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return fmt.Sprintf("%x", hash)
}

func verifyPassword(password, hashedPassword string) bool {
	// In production, implement proper Argon2id verification
	// For now, using simple comparison (NOT SECURE - for demo only)
	return hashPassword(password) == hashedPassword
}
