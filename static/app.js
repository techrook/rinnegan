
let socket;
let localStream;


const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomIdInput = document.getElementById('roomIdInput');
const userIdInput = document.getElementById('userIdInput');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messages');


async function initLocalStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        localVideo.srcObject = stream;
        addSystemMessage("Camera and microphone initialized.");
    } catch (err) {
        console.error("Error accessing media devices:", err);
        addSystemMessage("Error: Could not access camera/microphone.");
    }
}


async function joinRoom() {
    const roomId = roomIdInput.value.trim();
    const userId = userIdInput.value.trim();

    if (!roomId || !userId) {
        alert("Please enter both Room ID and User ID.");
        return;
    }


    await initLocalStream();


    socket = new WebSocket(`ws://localhost:8080/ws?room=${roomId}&user=${userId}`);


    socket.onopen = function () {
        addSystemMessage(`Connected to Room: ${roomId} as ${userId}`);
    };

    socket.onclose = function (event) {
        addSystemMessage("Disconnected from signaling server.");
        console.log("Socket closed:", event);
    };

    socket.onerror = function (error) {
        addSystemMessage("Connection error occurred.");
        console.error("Socket error:", error);
    };

    socket.onmessage = function (event) {
        const message = JSON.parse(event.data);
        console.log("Received from server:", message);

        if (message.action === "chat") {
            appendChatMessage(message.senderId, message.payload, false);
        }
    };
}


function submit() {
    const text = messageInput.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;


    const message = {
        action: "chat",
        roomId: roomIdInput.value.trim(),
        payload: text
    };

    socket.send(JSON.stringify(message));
    appendChatMessage("You", text, true);
    messageInput.value = "";
}



function addSystemMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message system';
    msg.innerText = text;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendChatMessage(sender, text, isSelf) {
    const msg = document.createElement('div');
    msg.className = `message ${isSelf ? 'self' : 'other'}`;
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.innerText = isSelf ? "You:" : `${sender}:`;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.innerText = text;
    
    msg.appendChild(senderSpan);
    msg.appendChild(textSpan);
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}