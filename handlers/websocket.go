package handlers

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"Rinnegan/models"
	"Rinnegan/utils"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// HandleWebSocket handles WebSocket connections
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade failed:", err)
		return
	}
	defer conn.Close()

	// Create new client
	client := models.NewClient(conn)
	models.RegisterClient(client)
	defer models.UnregisterClient(client)

	log.Printf("Client connected! Total clients: %d", models.GetClientCount())

	// Start listening for messages
	utils.ReadMessages(client)
}
