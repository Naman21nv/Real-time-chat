// Initialize Socket.io connection
const socket = io();

// DOM elements
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const messageForm = document.getElementById('message-form');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const messageInput = document.getElementById('message-input');
const messagesDiv = document.getElementById('messages');
const roomNameElement = document.getElementById('room-name');
const userCountElement = document.getElementById('user-count');
const usersListElement = document.getElementById('users-list');
const leaveBtn = document.getElementById('leave-btn');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');

// Current user state
let currentUser = {
    username: '',
    room: ''
};

// Typing timeout
let typingTimeout;

// Login form submission
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim();
    
    if (username && room) {
        currentUser.username = username;
        currentUser.room = room;
        
        // Emit join-room event
        socket.emit('join-room', { username, room });
        
        // Switch to chat interface
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        // Update room name
        roomNameElement.textContent = room;
        
        // Focus on message input
        messageInput.focus();
    }
});

// Message form submission
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    if (message) {
        // Emit chat message
        socket.emit('chat-message', { message });
        
        // Clear input
        messageInput.value = '';
        
        // Stop typing indicator
        socket.emit('typing', false);
    }
});

// Typing indicator
messageInput.addEventListener('input', () => {
    socket.emit('typing', true);
    
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    // Stop typing after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
        socket.emit('typing', false);
    }, 2000);
});

// Leave room button
leaveBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave this room?')) {
        socket.disconnect();
        location.reload();
    }
});

// Socket event listeners

// Receive chat messages
socket.on('chat-message', (data) => {
    displayMessage(data);
    scrollToBottom();
});

// User joined notification
socket.on('user-joined', (data) => {
    displaySystemMessage(data.message);
    scrollToBottom();
});

// User left notification
socket.on('user-left', (data) => {
    displaySystemMessage(data.message);
    scrollToBottom();
});

// Update room users list
socket.on('room-users', (users) => {
    updateUsersList(users);
    updateUserCount(users.length);
});

// Typing indicator
socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingText.textContent = `${data.username} is typing...`;
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
});

// Helper functions

// Display a chat message
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = data.username === currentUser.username;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-header">${escapeHtml(data.username)}</div>
        <div class="message-bubble">${escapeHtml(data.message)}</div>
        <div class="message-time">${time}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
}

// Display system message
function displaySystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messagesDiv.appendChild(messageDiv);
}

// Update users list in sidebar
function updateUsersList(users) {
    usersListElement.innerHTML = '';
    
    users.forEach(username => {
        const li = document.createElement('li');
        li.textContent = username;
        
        // Highlight current user
        if (username === currentUser.username) {
            li.textContent = `${username} (You)`;
            li.style.fontWeight = 'bold';
        }
        
        usersListElement.appendChild(li);
    });
}

// Update user count
function updateUserCount(count) {
    userCountElement.textContent = `${count} user${count !== 1 ? 's' : ''} online`;
}

// Scroll to bottom of messages
function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle connection errors
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Unable to connect to the server. Please try again later.');
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
