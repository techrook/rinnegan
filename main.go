package main

import (
	"fmt"
	"net/http"

	"Rinnegan/handlers"
)

func main() {
	http.HandleFunc("/ws", handlers.HandleWebSocket)
	
	http.Handle("/", http.FileServer(http.Dir("./static")))
	
	port := ":8080"
	fmt.Printf("Server starting on http://localhost%s\n", port)
	
	err := http.ListenAndServe(port, nil)
	if err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}
}