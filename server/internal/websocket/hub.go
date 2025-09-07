package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"nhooyr.io/websocket"
)

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from the clients
	broadcast chan []byte

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// User-specific message routing
	userClients map[string]map[*Client]bool

	// Mutex for userClients map
	userMutex sync.RWMutex
}

// Client represents a websocket client
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID string
}

// Message represents a websocket message
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// NewHub creates a new hub
func NewHub() *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		broadcast:   make(chan []byte),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		userClients: make(map[string]map[*Client]bool),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			h.userMutex.Lock()
			if h.userClients[client.userID] == nil {
				h.userClients[client.userID] = make(map[*Client]bool)
			}
			h.userClients[client.userID][client] = true
			h.userMutex.Unlock()
			log.Printf("Client registered for user %s", client.userID)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				h.userMutex.Lock()
				if userClients, exists := h.userClients[client.userID]; exists {
					delete(userClients, client)
					if len(userClients) == 0 {
						delete(h.userClients, client.userID)
					}
				}
				h.userMutex.Unlock()
				log.Printf("Client unregistered for user %s", client.userID)
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// SendToUser sends a message to all clients of a specific user
func (h *Hub) SendToUser(userID string, message interface{}) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.userMutex.RLock()
	userClients, exists := h.userClients[userID]
	h.userMutex.RUnlock()

	if !exists {
		return
	}

	for client := range userClients {
		select {
		case client.send <- data:
		default:
			close(client.send)
			delete(h.clients, client)
			h.userMutex.Lock()
			delete(userClients, client)
			if len(userClients) == 0 {
				delete(h.userClients, userID)
			}
			h.userMutex.Unlock()
		}
	}
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(message interface{}) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.broadcast <- data
}
