require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// User Schema (Mobile Number Registration)
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// API: Login / Register with Phone Number
app.post('/api/login', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Mobile number is required" });

  try {
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({ phone });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Real-Time Socket Connection
io.on('connection', (socket) => {
  socket.on('join', (phone) => {
    socket.join(phone);
  });

  socket.on('send_message', async (data) => {
    const { sender, receiver, message } = data;
    const newMsg = new Message({ sender, receiver, message });
    await newMsg.save();

    io.to(receiver).emit('receive_message', newMsg);
    io.to(sender).emit('receive_message', newMsg);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
