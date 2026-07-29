package handlers

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"

)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade failed:", err)
		return
	}
	defer conn.Close()


	for {

			messageType, payload, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Client disconnected or error occurred: %v\n", err)
				break 
			}
			log.Printf("Received message: %s (Type: %d)\n", string(payload), messageType)
			err = conn.WriteMessage(messageType, payload)
			if err != nil {
				log.Println("Failed to send response:", err)
				break
			}
		}

		log.Println("Cleaning up client resources...")
	}
	func main() {

}
