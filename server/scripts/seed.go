package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"e2ee-messenger/server/internal/database"
	"e2ee-messenger/server/internal/models"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

func main() {
	// Connect to database
	db, err := database.New("postgres://postgres:password@localhost:5432/e2ee_messenger?sslmode=disable")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Create test users
	users := []models.User{
		{
			ID:        uuid.New(),
			Username:  "alice",
			Email:     "alice@example.com",
			Password:  "hashed_password_alice", // In production, use proper hashing
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			Username:  "bob",
			Email:     "bob@example.com",
			Password:  "hashed_password_bob", // In production, use proper hashing
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	// Insert users
	for _, user := range users {
		_, err := db.Exec(`
			INSERT INTO users (id, username, email, password, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (email) DO NOTHING
		`, user.ID, user.Username, user.Email, user.Password, user.CreatedAt, user.UpdatedAt)
		if err != nil {
			log.Printf("Failed to insert user %s: %v", user.Username, err)
		} else {
			log.Printf("Created user: %s (%s)", user.Username, user.Email)
		}
	}

	// Create device keys for users
	deviceKeys := []models.DeviceKey{
		{
			ID:        uuid.New(),
			UserID:    users[0].ID,
			DeviceID:  "device-alice-1",
			PublicKey: "alice-device-key-1",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			UserID:    users[1].ID,
			DeviceID:  "device-bob-1",
			PublicKey: "bob-device-key-1",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	for _, key := range deviceKeys {
		_, err := db.Exec(`
			INSERT INTO device_keys (id, user_id, device_id, public_key, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (user_id, device_id) DO NOTHING
		`, key.ID, key.UserID, key.DeviceID, key.PublicKey, key.CreatedAt, key.UpdatedAt)
		if err != nil {
			log.Printf("Failed to insert device key: %v", err)
		} else {
			log.Printf("Created device key for user %s", key.UserID)
		}
	}

	// Create one-time keys
	oneTimeKeys := []models.OneTimeKey{
		{
			ID:        uuid.New(),
			UserID:    users[0].ID,
			KeyID:     "otk-alice-1",
			PublicKey: "alice-one-time-key-1",
			Used:      false,
			CreatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			UserID:    users[0].ID,
			KeyID:     "otk-alice-2",
			PublicKey: "alice-one-time-key-2",
			Used:      false,
			CreatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			UserID:    users[1].ID,
			KeyID:     "otk-bob-1",
			PublicKey: "bob-one-time-key-1",
			Used:      false,
			CreatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			UserID:    users[1].ID,
			KeyID:     "otk-bob-2",
			PublicKey: "bob-one-time-key-2",
			Used:      false,
			CreatedAt: time.Now(),
		},
	}

	for _, key := range oneTimeKeys {
		_, err := db.Exec(`
			INSERT INTO one_time_keys (id, user_id, key_id, public_key, used, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (user_id, key_id) DO NOTHING
		`, key.ID, key.UserID, key.KeyID, key.PublicKey, key.Used, key.CreatedAt)
		if err != nil {
			log.Printf("Failed to insert one-time key: %v", err)
		} else {
			log.Printf("Created one-time key %s for user %s", key.KeyID, key.UserID)
		}
	}

	// Create some sample messages
	messages := []models.Message{
		{
			ID:               uuid.New(),
			SenderID:         users[0].ID,
			RecipientID:      users[1].ID,
			EncryptedContent: "encrypted-hello-from-alice",
			MessageType:      "text",
			CreatedAt:        time.Now().Add(-2 * time.Hour),
		},
		{
			ID:               uuid.New(),
			SenderID:         users[1].ID,
			RecipientID:      users[0].ID,
			EncryptedContent: "encrypted-hello-back-from-bob",
			MessageType:      "text",
			CreatedAt:        time.Now().Add(-1 * time.Hour),
		},
		{
			ID:               uuid.New(),
			SenderID:         users[0].ID,
			RecipientID:      users[1].ID,
			EncryptedContent: "encrypted-how-are-you",
			MessageType:      "text",
			CreatedAt:        time.Now().Add(-30 * time.Minute),
		},
	}

	for _, message := range messages {
		_, err := db.Exec(`
			INSERT INTO messages (id, sender_id, recipient_id, encrypted_content, message_type, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, message.ID, message.SenderID, message.RecipientID, message.EncryptedContent, message.MessageType, message.CreatedAt)
		if err != nil {
			log.Printf("Failed to insert message: %v", err)
		} else {
			log.Printf("Created message from %s to %s", message.SenderID, message.RecipientID)
		}
	}

	log.Println("Seed data created successfully!")
}
