package models

import (
	"sync"
	
	"github.com/gorilla/websocket"
)

type Client struct {
	Conn *websocket.Conn
	Send chan []byte
}


var (
	clients   = make(map[*Client]bool)
	clientsMu sync.RWMutex
)


func NewClient(conn *websocket.Conn) *Client {
	return &Client{
		Conn: conn,
		Send: make(chan []byte, 256),
	}
}


func RegisterClient(client *Client) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	clients[client] = true
}


func UnregisterClient(client *Client) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	delete(clients, client)
	close(client.Send)
}


func GetClientCount() int {
	clientsMu.RLock()
	defer clientsMu.RUnlock()
	return len(clients)
}


func Broadcast(message []byte) {
	clientsMu.RLock()
	defer clientsMu.RUnlock()
	
	for client := range clients {
		select {
		case client.Send <- message:
		default:
			// Client's send buffer is full, skip
		}
	}
}