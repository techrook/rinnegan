package handlers

import (
	"encoding/json"
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

// writePump queues messages and writes them to the client browser
func (c *Client) writePump() {
	defer func() {
		c.Conn.Close()
	}()
	for message := range c.Send {
		err := c.Conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Println("Write error:", err)
			return
		}
	}
}

// readPump reads incoming signaling packets and broadcasts them to the other client
func (c *Client) readPump(roomId string) {
	defer func() {
		GlobalHub.LeaveRoom(c, roomId)
		c.Conn.Close()
	}()

	for {
		_, payload, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(payload, &msg); err != nil {
			log.Println("JSON unmarshal error:", err)
			continue
		}

		msg.SenderId = c.Id
		msg.RoomId = roomId

		GlobalHub.Broadcast(c, msg)
	}
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {

	roomId := r.URL.Query().Get("room")
	userId := r.URL.Query().Get("user")

	if roomId == "" || userId == "" {
		http.Error(w, "Missing room or user parameter", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade failed:", err)
		return
	}

	client := &Client{
		Id:   userId,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	// Try to add the client to the room
	err = GlobalHub.JoinRoom(client, roomId)
	if err != nil {
		log.Println("Join room failed:", err)
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, err.Error()))
		conn.Close()
		return
	}

	// Start reading and writing asynchronously
	go client.writePump()
	client.readPump(roomId)
}