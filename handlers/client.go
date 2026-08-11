package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	Id   string
	Conn *websocket.Conn
	Send chan []byte
}

type Room struct {
	Id      string
	Clients map[*Client]bool
	Mutex   sync.RWMutex
}

type Hub struct {
	Rooms map[string]*Room
	Mutex sync.RWMutex
}


type Message struct {
	Action   string `json:"action"`   
	RoomId   string `json:"roomId"`   
	SenderId string `json:"senderId"` 
	Payload  any    `json:"payload"`  
}

func NewHub() *Hub {
	return &Hub{
		Rooms: make(map[string]*Room),
	}
}


var GlobalHub = NewHub()

func (h *Hub) JoinRoom(client *Client, roomId string) error {
	h.Mutex.Lock()
	if _, ok := h.Rooms[roomId]; !ok {
		h.Rooms[roomId] = &Room{
			Id:      roomId,
			Clients: make(map[*Client]bool),
		}
	}
	room := h.Rooms[roomId]
	h.Mutex.Unlock()

	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	// If a client with the same User ID is already connected (e.g. page refresh), remove the stale connection
	for existing := range room.Clients {
		if existing.Id == client.Id {
			delete(room.Clients, existing)
			existing.Conn.Close()
		}
	}

	if len(room.Clients) >= 2 {
		return errors.New("room is full")
	}

	room.Clients[client] = true
	return nil
}

func (h *Hub) LeaveRoom(client *Client, roomId string) {
	h.Mutex.Lock()
	room, exists := h.Rooms[roomId]
	h.Mutex.Unlock()

	if !exists || room == nil {
		return
	}

	room.Mutex.Lock()
	delete(room.Clients, client)
	isEmpty := len(room.Clients) == 0
	room.Mutex.Unlock()

	if isEmpty {
		h.Mutex.Lock()
		delete(h.Rooms, roomId)
		h.Mutex.Unlock()
	}
}


func (h *Hub) Broadcast(sender *Client, msg Message) {
	h.Mutex.RLock()
	room, exists := h.Rooms[msg.RoomId]
	h.Mutex.RUnlock()

	if !exists || room == nil {
		return
	}

	room.Mutex.RLock()
	defer room.Mutex.RUnlock()

	jsonBytes, err := json.Marshal(msg)
	if err != nil {
		log.Println("JSON marshal error:", err)
		return
	}

	for client := range room.Clients {
		if client.Id != sender.Id {
			select {
			case client.Send <- jsonBytes:
			default:
				close(client.Send)
				delete(room.Clients, client)
			}
		}
	}
}