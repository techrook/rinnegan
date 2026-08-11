
let socket;
let localStream;
let peerConnection;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomIdInput = document.getElementById('roomIdInput');
const userIdInput = document.getElementById('userIdInput');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messages');

// 1. Initialize local camera and microphone stream
async function initLocalStream() {
    if (localStream) return true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        localVideo.srcObject = stream;
        addSystemMessage("Camera and microphone initialized.");
        return true;
    } catch (err) {
        console.error("Error accessing media devices:", err);
        // Attempt audio-only fallback if camera is locked by another browser/app
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStream = audioStream;
            localVideo.srcObject = audioStream;
            addSystemMessage("Microphone initialized (audio only).");
            return true;
        } catch (audioErr) {
            addSystemMessage("Error: Could not access camera or microphone.");
            alert("Could not access camera/microphone. If another browser is using your webcam, please close it or test using Chrome Incognito!");
            return false;
        }
    }
}

// 2. Instantiate RTCPeerConnection and bind tracks/listeners
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Attach local media tracks to WebRTC peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle incoming remote media tracks
    peerConnection.ontrack = (event) => {
        console.log("Received remote track:", event.streams);
        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            addSystemMessage("Remote video stream connected!");
        }
    };

    // Handle local ICE candidate discovery
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage("candidate", event.candidate);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("ICE Connection State:", peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            addSystemMessage("Peer connection lost.");
        }
    };
}

// 3. Connect to WebSocket signaling server
async function joinRoom() {
    const roomId = roomIdInput.value.trim();
    const userId = userIdInput.value.trim();

    if (!roomId || !userId) {
        alert("Please enter both Room ID and User ID.");
        return;
    }

    const streamOk = await initLocalStream();
    if (!streamOk) {
        return; // Abort connection if media capture failed
    }

    // Close any existing socket connection before reconnecting
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host || 'localhost:8080';
    socket = new WebSocket(`${wsProtocol}//${wsHost}/ws?room=${roomId}&user=${userId}`);

    socket.onopen = function () {
        addSystemMessage(`Connected to Room: ${roomId} as ${userId}`);
        // Notify other user in room that we are ready
        sendSignalingMessage("ready", null);
    };

    socket.onclose = function (event) {
        addSystemMessage("Disconnected from signaling server.");
        if (peerConnection) {
            peerConnection.close();
        }
    };

    socket.onerror = function (error) {
        addSystemMessage("Connection error occurred.");
        console.error("Socket error:", error);
    };

    socket.onmessage = async function (event) {
        const message = JSON.parse(event.data);
        console.log("Received signaling message:", message);

        switch (message.action) {
            case "ready":
                // A peer joined, start WebRTC offer negotiation
                handlePeerReady();
                break;
            case "offer":
                handleOffer(message.payload);
                break;
            case "answer":
                handleAnswer(message.payload);
                break;
            case "candidate":
                handleCandidate(message.payload);
                break;
            case "chat":
                appendChatMessage(message.senderId, message.payload, false);
                break;
        }
    };
}

// WebRTC Negotiation Handlers
async function handlePeerReady() {
    if (!peerConnection) {
        createPeerConnection();
    }
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignalingMessage("offer", offer);
        console.log("Sent WebRTC Offer.");
    } catch (err) {
        console.error("Error creating offer:", err);
    }
}

async function handleOffer(offer) {
    if (!peerConnection) {
        createPeerConnection();
    }
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendSignalingMessage("answer", answer);
        console.log("Sent WebRTC Answer.");
    } catch (err) {
        console.error("Error handling offer:", err);
    }
}

async function handleAnswer(answer) {
    try {
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log("Set WebRTC Answer.");
        }
    } catch (err) {
        console.error("Error setting answer:", err);
    }
}

async function handleCandidate(candidate) {
    try {
        if (peerConnection && candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("Added ICE Candidate.");
        }
    } catch (err) {
        console.error("Error adding ICE candidate:", err);
    }
}

function sendSignalingMessage(action, payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const message = {
        action: action,
        roomId: roomIdInput.value.trim(),
        payload: payload
    };
    socket.send(JSON.stringify(message));
}

function submit() {
    const text = messageInput.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

    sendSignalingMessage("chat", text);
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