package utils

import (
	"log"
	"github.com/gorilla/websocket"
	
	"Rinnegan/models"
)

// ReadMessages reads messages from a client and broadcasts them
func ReadMessages(client *models.Client) {
	defer func() {
		client.Conn.Close()
		models.UnregisterClient(client)
	}()
	
	for {
		// Read message from client
		messageType, msg, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		
		log.Printf("Received: %s", msg)
		
		// Echo back to all clients (or you can modify this logic)
		models.Broadcast(msg)
		
		// Optional: Send confirmation to the sender
		// client.Conn.WriteMessage(messageType, []byte("Message received!"))
		
		_ = messageType // Used if you want to send back same message type
	}
}