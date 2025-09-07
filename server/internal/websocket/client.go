package websocket

import (
	"context"
	"log"
	"net/http"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

// ServeWS handles websocket requests from clients
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, userID string) {
	// Upgrade connection to websocket
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // In production, implement proper origin checking
	})
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
	}

	client.hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the websocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close(websocket.StatusNormalClosure, "")
	}()

	// Set read limit
	c.conn.SetReadLimit(maxMessageSize)

	// Set read timeout
	ctx, cancel := context.WithTimeout(context.Background(), pongWait)
	defer cancel()

	for {
		var msg Message
		err := wsjson.Read(ctx, c.conn, &msg)
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				websocket.CloseStatus(err) == websocket.StatusGoingAway {
				log.Printf("WebSocket closed normally for user %s", c.userID)
			} else {
				log.Printf("WebSocket read error for user %s: %v", c.userID, err)
			}
			break
		}

		// Handle different message types
		switch msg.Type {
		case "ping":
			// Respond to ping with pong
			select {
			case c.send <- []byte(`{"type":"pong","payload":{"timestamp":"` + time.Now().Format(time.RFC3339) + `"}}`):
			default:
				close(c.send)
				return
			}
		case "message_received":
			// Handle message received acknowledgment
			log.Printf("Message received acknowledgment from user %s", c.userID)
		default:
			log.Printf("Unknown message type from user %s: %s", c.userID, msg.Type)
		}

		// Reset context for next read
		cancel()
		ctx, cancel = context.WithTimeout(context.Background(), pongWait)
	}
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close(websocket.StatusNormalClosure, "")
	}()

	for {
		select {
		case message, ok := <-c.send:
			ctx, cancel := context.WithTimeout(context.Background(), writeWait)
			if !ok {
				// The hub closed the channel
				c.conn.Close(websocket.StatusNormalClosure, "")
				cancel()
				return
			}

			if err := c.conn.Write(ctx, websocket.MessageText, message); err != nil {
				log.Printf("WebSocket write error for user %s: %v", c.userID, err)
				cancel()
				return
			}
			cancel()

		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), writeWait)
			if err := c.conn.Ping(ctx); err != nil {
				log.Printf("WebSocket ping error for user %s: %v", c.userID, err)
				cancel()
				return
			}
			cancel()
		}
	}
}
