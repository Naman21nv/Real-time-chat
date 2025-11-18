const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active users and their rooms
const users = new Map(); // userId -> { username, room }
const rooms = new Map(); // roomName -> Set of userIds

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining a room
  socket.on('join-room', ({ username, room }) => {
    // Leave previous room if exists
    const previousUser = users.get(socket.id);
    if (previousUser) {
      leaveRoom(socket.id, previousUser.room);
    }

    // Join new room
    socket.join(room);
    users.set(socket.id, { username, room });

    // Add to room tracking
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room).add(socket.id);

    // Notify others in the room
    socket.to(room).emit('user-joined', {
      username,
      message: `${username} joined the room`,
      timestamp: new Date().toISOString()
    });

    // Send room info to the user
    const roomUsers = getRoomUsers(room);
    socket.emit('room-users', roomUsers);
    
    // Broadcast updated user list to everyone in the room
    io.to(room).emit('room-users', roomUsers);

    console.log(`${username} joined room: ${room}`);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const user = users.get(socket.id);
    if (user) {
      const messageData = {
        id: Date.now() + Math.random(),
        username: user.username,
        message: data.message,
        timestamp: new Date().toISOString(),
        room: user.room
      };

      // Broadcast message to all users in the room
      io.to(user.room).emit('chat-message', messageData);
      console.log(`Message in ${user.room} from ${user.username}: ${data.message}`);
    }
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.room).emit('user-typing', {
        username: user.username,
        isTyping
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      leaveRoom(socket.id, user.room);
      console.log(`${user.username} disconnected`);
    }
  });
});

// Helper function to leave a room
function leaveRoom(userId, room) {
  const user = users.get(userId);
  if (user && rooms.has(room)) {
    rooms.get(room).delete(userId);
    
    // Clean up empty rooms
    if (rooms.get(room).size === 0) {
      rooms.delete(room);
    }

    // Notify others
    io.to(room).emit('user-left', {
      username: user.username,
      message: `${user.username} left the room`,
      timestamp: new Date().toISOString()
    });

    // Update user list
    const roomUsers = getRoomUsers(room);
    io.to(room).emit('room-users', roomUsers);

    users.delete(userId);
  }
}

// Helper function to get all users in a room
function getRoomUsers(room) {
  if (!rooms.has(room)) return [];
  
  const userIds = Array.from(rooms.get(room));
  return userIds.map(id => {
    const user = users.get(id);
    return user ? user.username : null;
  }).filter(username => username !== null);
}

// Get list of active rooms
app.get('/api/rooms', (req, res) => {
  const activeRooms = Array.from(rooms.keys());
  res.json({ rooms: activeRooms });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
