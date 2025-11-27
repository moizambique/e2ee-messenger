package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Username  string    `json:"username" db:"username"`
	Email     string    `json:"email" db:"email"`
	Password  string    `json:"-" db:"password"` // Never expose password in JSON
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Chat represents a conversation in the chat list
type Chat struct {
	ID               string    `json:"id"`
	Type             string    `json:"type"`
	Name             string    `json:"name"`
	Participant      *User     `json:"participant,omitempty"`
	LastMessage      *Message  `json:"last_message,omitempty"`
	UnreadCount      int       `json:"unread_count"`
	UpdatedAt        time.Time `json:"updated_at"`
	ParticipantCount int       `json:"participant_count,omitempty"`
}

// DeviceKey represents a device's identity key
type DeviceKey struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	DeviceID  string    `json:"device_id" db:"device_id"`
	PublicKey string    `json:"public_key" db:"public_key"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// OneTimeKey represents a one-time prekey
type OneTimeKey struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	KeyID     string    `json:"key_id" db:"key_id"`
	PublicKey string    `json:"public_key" db:"public_key"`
	Used      bool      `json:"used" db:"used"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Message represents an encrypted message
type Message struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	SenderID    uuid.UUID  `json:"sender_id" db:"sender_id"`
	RecipientID *uuid.UUID `json:"recipient_id,omitempty" db:"recipient_id"`
	GroupID     *uuid.UUID `json:"group_id,omitempty" db:"group_id"`
	// Note: We never store plaintext content
	EncryptedContent string    `json:"encrypted_content" db:"encrypted_content"`
	MessageType      string    `json:"message_type" db:"message_type"` // "text", "file", "system"
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

// Receipt represents a message receipt (delivered, read)
type Receipt struct {
	ID        uuid.UUID `json:"id" db:"id"`
	MessageID uuid.UUID `json:"message_id" db:"message_id"`
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	Type      string    `json:"type" db:"type"` // "delivered", "read"
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Group represents a group chat (Phase 2 placeholder)
type Group struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	CreatedBy   uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// GroupMember represents a group membership (Phase 2 placeholder)
type GroupMember struct {
	ID       uuid.UUID `json:"id" db:"id"`
	GroupID  uuid.UUID `json:"group_id" db:"group_id"`
	UserID   uuid.UUID `json:"user_id" db:"user_id"`
	Role     string    `json:"role" db:"role"` // "admin", "member"
	JoinedAt time.Time `json:"joined_at" db:"joined_at"`
}

// Attachment represents an encrypted file attachment (Phase 2 placeholder)
type Attachment struct {
	ID           uuid.UUID `json:"id" db:"id"`
	MessageID    uuid.UUID `json:"message_id" db:"message_id"`
	FileName     string    `json:"file_name" db:"file_name"`
	FileSize     int64     `json:"file_size" db:"file_size"`
	MimeType     string    `json:"mime_type" db:"mime_type"`
	StoragePath  string    `json:"storage_path" db:"storage_path"`
	EncryptedKey string    `json:"encrypted_key" db:"encrypted_key"` // AES key encrypted with recipient's key
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// Request/Response DTOs

// SignupRequest represents a user signup request
type SignupRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

// LoginRequest represents a user login request
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// UpdateProfileRequest represents a user profile update request
type UpdateProfileRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

// CreateGroupRequest represents a request to create a new group
type CreateGroupRequest struct {
	Name      string   `json:"name" validate:"required,min=1,max=255"`
	MemberIDs []string `json:"member_ids" validate:"required,min=1"`
}

// AuthResponse represents an authentication response
type AuthResponse struct {
	Token    string `json:"token"`
	User     User   `json:"user"`
	DeviceID string `json:"device_id"`
}

// DeviceKeyRequest represents a device key upload request
type DeviceKeyRequest struct {
	DeviceID  string `json:"device_id" validate:"required"`
	PublicKey string `json:"public_key" validate:"required"`
}

// OneTimeKeyRequest represents a one-time key upload request
type OneTimeKeyRequest struct {
	KeyID     string `json:"key_id" validate:"required"`
	PublicKey string `json:"public_key" validate:"required"`
}

// BootstrapKeysResponse represents the response for bootstrap keys
type BootstrapKeysResponse struct {
	DeviceKeys  []DeviceKey  `json:"device_keys"`
	OneTimeKeys []OneTimeKey `json:"one_time_keys"`
}

// SendMessageRequest represents a message send request
type SendMessageRequest struct {
	RecipientID      *string `json:"recipient_id,omitempty"`
	GroupID          *string `json:"group_id,omitempty"`
	EncryptedContent string  `json:"encrypted_content" validate:"required"`
	MessageType      string  `json:"message_type" validate:"required,oneof=text file system"`
}

// GetMessagesRequest represents a get messages request
type GetMessagesRequest struct {
	RecipientID string `json:"recipient_id" validate:"required"`
	Since       string `json:"since,omitempty"` // ISO timestamp
	Limit       int    `json:"limit,omitempty"`
}

// SendReceiptRequest represents a receipt send request
type SendReceiptRequest struct {
	MessageID string `json:"message_id" validate:"required"`
	Type      string `json:"type" validate:"required,oneof=delivered read"`
}
