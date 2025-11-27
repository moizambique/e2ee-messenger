package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"e2ee-messenger/server/internal/config"
	"e2ee-messenger/server/internal/database"
	"e2ee-messenger/server/internal/handlers"
	"e2ee-messenger/server/internal/models"
	"e2ee-messenger/server/internal/websocket"

	"github.com/google/uuid"
)

func setupTestHandlers() *handlers.Handlers {
	// Create in-memory database for testing
	db, _ := database.New(":memory:")
	database.Migrate(db)

	hub := websocket.NewHub()
	cfg := &config.Config{
		JWTSecret: "test-secret",
	}

	return handlers.New(db, hub, cfg)
}

func TestSignup(t *testing.T) {
	h := setupTestHandlers()

	tests := []struct {
		name           string
		request        models.SignupRequest
		expectedStatus int
		expectError    bool
	}{
		{
			name: "valid signup",
			request: models.SignupRequest{
				Username: "testuser",
				Email:    "test@example.com",
				Password: "password123",
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name: "missing username",
			request: models.SignupRequest{
				Email:    "test@example.com",
				Password: "password123",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "invalid email",
			request: models.SignupRequest{
				Username: "testuser",
				Email:    "invalid-email",
				Password: "password123",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "short password",
			request: models.SignupRequest{
				Username: "testuser",
				Email:    "test@example.com",
				Password: "123",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			h.Signup(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusOK {
				var response models.AuthResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if response.Token == "" {
					t.Error("Expected token in response")
				}

				if response.User.Username != tt.request.Username {
					t.Errorf("Expected username %s, got %s", tt.request.Username, response.User.Username)
				}
			}
		})
	}
}

func TestLogin(t *testing.T) {
	h := setupTestHandlers()

	// First create a user
	signupReq := models.SignupRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	body, _ := json.Marshal(signupReq)
	req := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Signup(w, req)

	tests := []struct {
		name           string
		request        models.LoginRequest
		expectedStatus int
		expectError    bool
	}{
		{
			name: "valid login",
			request: models.LoginRequest{
				Email:    "test@example.com",
				Password: "password123",
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name: "invalid email",
			request: models.LoginRequest{
				Email:    "wrong@example.com",
				Password: "password123",
			},
			expectedStatus: http.StatusUnauthorized,
			expectError:    true,
		},
		{
			name: "invalid password",
			request: models.LoginRequest{
				Email:    "test@example.com",
				Password: "wrongpassword",
			},
			expectedStatus: http.StatusUnauthorized,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.request)
			req := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			h.Login(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusOK {
				var response models.AuthResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if response.Token == "" {
					t.Error("Expected token in response")
				}
			}
		})
	}
}

func TestUploadDeviceKey(t *testing.T) {
	h := setupTestHandlers()

	// Create a user and get token
	userID := uuid.New()
	token := "test-token" // In real test, generate proper JWT

	req := httptest.NewRequest("POST", "/v1/keys/device", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	// Add user to context (simulate middleware)
	ctx := context.WithValue(req.Context(), "user_id", userID)
	req = req.WithContext(ctx)

	deviceKeyReq := models.DeviceKeyRequest{
		DeviceID:  "test-device",
		PublicKey: "test-public-key",
	}

	body, _ := json.Marshal(deviceKeyReq)
	req.Body = http.NoBody // Reset body
	req = httptest.NewRequest("POST", "/v1/keys/device", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	ctx = context.WithValue(req.Context(), "user_id", userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.UploadDeviceKey(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.DeviceKey
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if response.DeviceID != deviceKeyReq.DeviceID {
		t.Errorf("Expected device ID %s, got %s", deviceKeyReq.DeviceID, response.DeviceID)
	}
}

func TestSendMessage(t *testing.T) {
	h := setupTestHandlers()

	// Create two users
	senderID := uuid.New()
	recipientID := uuid.New()

	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")

	// Add sender to context
	ctx := context.WithValue(req.Context(), "user_id", senderID)
	req = req.WithContext(ctx)

	recipientIDStr := recipientID.String()
	messageReq := models.SendMessageRequest{
		RecipientID:      &recipientIDStr,
		EncryptedContent: "encrypted-message-content",
		MessageType:      "text",
	}

	body, _ := json.Marshal(messageReq)
	req.Body = http.NoBody
	req = httptest.NewRequest("POST", "/v1/messages", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")
	ctx = context.WithValue(req.Context(), "user_id", senderID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.SendMessage(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.Message
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if response.SenderID != senderID {
		t.Errorf("Expected sender ID %s, got %s", senderID, response.SenderID)
	}

	if response.RecipientID == nil || *response.RecipientID != recipientID {
		t.Errorf("Expected recipient ID %s, got %s", recipientID, response.RecipientID.String())
	}
}
