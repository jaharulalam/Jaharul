const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Models
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }
});

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    text: { type: String, default: '' },
    image: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' }, // Status Field Added
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username aur Password zaroori hain' });

        const cleanUsername = username.trim().toLowerCase();
        const existingUser = await User.findOne({ username: cleanUsername });
        if (existingUser) return res.status(400).json({ error: 'Yeh username pehle se maujood hai' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username: cleanUsername, password: hashedPassword });
        await newUser.save();

        const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax' });
        res.json({ message: 'Registration successful', username: cleanUsername });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUsername = username.trim().toLowerCase();

        const user = await User.findOne({ username: cleanUsername });
        if (!user) return res.status(400).json({ error: 'Invalid username or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax' });
        res.json({ message: 'Login successful', username: cleanUsername });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ username: req.user.username });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// --- USER SEARCH ROUTE ---
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q || '';
        const users = await User.find({
            username: { $regex: query, $options: 'i' },
            username: { $ne: req.user.username }
        }).select('username -_id');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- CHAT ROUTES ---

// Get Messages & Mark Received Messages as Read
app.get('/api/messages/:targetUser', authenticateToken, async (req, res) => {
    try {
        const current = req.user.username;
        const target = req.params.targetUser.toLowerCase();

        // Mark incoming messages as read
        await Message.updateMany(
            { sender: target, receiver: current, status: { $ne: 'read' } },
            { $set: { status: 'read' } }
        );

        const messages = await Message.find({
            $or: [
                { sender: current, receiver: target },
                { sender: target, receiver: current }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send Message
app.post('/api/messages/:targetUser', authenticateToken, async (req, res) => {
    try {
        const current = req.user.username;
        const target = req.params.targetUser.toLowerCase();
        const { text, image } = req.body;

        const newMsg = new Message({
            sender: current,
            receiver: target,
            text: text || '',
            image: image || '',
            status: 'sent'
        });

        await newMsg.save();
        res.json(newMsg);
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Database Connection & Server Start
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
