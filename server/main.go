package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"e2ee-messenger/server/internal/config"
	"e2ee-messenger/server/internal/database"
	"e2ee-messenger/server/internal/handlers"
	authmiddleware "e2ee-messenger/server/internal/middleware"
	"e2ee-messenger/server/internal/websocket"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Initialize handlers
	h := handlers.New(db, hub, cfg)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"}, // In production, specify exact origins
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Serve static files from the "uploads" directory
	fs := http.FileServer(http.Dir("uploads"))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", fs))

	// API routes
	r.Route("/v1", func(r chi.Router) {
		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/signup", h.Signup)
			r.Post("/login", h.Login)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.Auth(cfg.JWTSecret))
			r.Use(authmiddleware.UserContext)

			// Profile
			r.Put("/profile", h.UpdateProfile)
			r.Post("/profile/avatar", h.UploadAvatar)
			r.Delete("/profile", h.DeleteAccount)
			r.Put("/profile/password", h.ChangePassword)

			// Users & Chats
			r.Get("/users", h.GetUsers)
			r.Get("/chats", h.GetChats)

			// Groups
			r.Post("/groups", h.CreateGroup)

			// Key management
			r.Route("/keys", func(r chi.Router) {
				r.Post("/device", h.UploadDeviceKey)
				r.Post("/one-time", h.UploadOneTimeKey)
				r.Get("/bootstrap", h.GetBootstrapKeys)
			})

			// Messages
			r.Route("/messages", func(r chi.Router) {
				r.Post("/", h.SendMessage)
				r.Post("/attachment", h.UploadAttachment)
				r.Get("/", h.GetMessages)
			})

			// Receipts
			r.Post("/receipts", h.SendReceipt)

			// WebSocket
			r.Get("/ws", h.WebSocketHandler)
		})
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Start server
	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
