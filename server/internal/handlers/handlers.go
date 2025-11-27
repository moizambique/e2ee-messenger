package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

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
		SELECT id, username, email, password, created_at, updated_at
		FROM users WHERE email = $1
	`, req.Email).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.CreatedAt, &user.UpdatedAt)

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
		RETURNING id, username, email, password, created_at, updated_at
	`, req.Username, time.Now(), userID).Scan(
		&updatedUser.ID, &updatedUser.Username, &updatedUser.Email, &updatedUser.Password, &updatedUser.CreatedAt, &updatedUser.UpdatedAt,
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

// GetUsers returns a list of all users, excluding the current user
func (h *Handlers) GetUsers(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	rows, err := h.db.Query(`
		SELECT id, username, email, created_at, updated_at
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
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt, &user.UpdatedAt); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to scan user")
			return
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
		var participantUsername, groupName, encryptedContent, messageType sql.NullString
		var participantCount sql.NullInt64

		err := rows.Scan(
			&chatType, &chatID, &lastMessageAt,
			&participantID, &participantUsername,
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
				ID:       uuid.MustParse(participantID.String),
				Username: participantUsername.String,
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

	log.Printf("Received SendMessage request for recipient: %s", req.RecipientID)

	recipientID, err := uuid.Parse(req.RecipientID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid recipient_id format")
		return
	}

	message := models.Message{
		ID:               uuid.New(),
		SenderID:         userID,
		RecipientID:      recipientID,
		EncryptedContent: req.EncryptedContent,
		MessageType:      req.MessageType,
		CreatedAt:        time.Now(),
	}

	log.Printf("DB INSERT: sender_id=%s, recipient_id=%s", message.SenderID, message.RecipientID)

	_, err = h.db.Exec(`
		INSERT INTO messages (id, sender_id, recipient_id, encrypted_content, message_type, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, message.ID, message.SenderID, message.RecipientID, message.EncryptedContent, message.MessageType, message.CreatedAt)

	if err != nil {
		log.Printf("Database error on message insert: %v", err) // Add detailed logging
		respondWithError(w, http.StatusInternalServerError, "Failed to send message")
		return
	}

	// Send real-time notification to recipient
	notification := websocket.Message{
		Type:    "new_message",
		Payload: message, // Send the full message object
	}

	h.hub.SendToUser(recipientID.String(), notification)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(message)
}

// GetMessages handles message retrieval
func (h *Handlers) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	recipientIDStr := r.URL.Query().Get("recipient_id")
	if recipientIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "recipient_id parameter required")
		return
	}

	recipientID, err := uuid.Parse(recipientIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid recipient_id format")
		return
	}

	since := r.URL.Query().Get("since")
	limitStr := r.URL.Query().Get("limit")
	limit := 50 // default limit

	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	var query string
	var args []interface{}

	if since != "" {
		query = `
			SELECT id, sender_id, recipient_id, encrypted_content, message_type, created_at
			FROM messages 
			WHERE ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1))
			AND created_at > $3			
			ORDER BY created_at DESC
			LIMIT $4
		`
		args = []interface{}{userID, recipientID, since, limit}
	} else {
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
		err := rows.Scan(&message.ID, &message.SenderID, &message.RecipientID, &message.EncryptedContent, &message.MessageType, &message.CreatedAt)
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
