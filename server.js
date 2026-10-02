const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jaharula20_db_user:jhsjM9UPiyflzxeh@cluster0.e5v95rf.mongodb.net/chatapp?appName=Cluster0';

// Fixed Admin credentials
const ADMIN_USERNAME = 'jaharul';
const ADMIN_PASSWORD = 'admin';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- MongoDB Schemas ----------------
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    number: { type: String, default: '' },
    password: { type: String, required: true },
    passwordPlain: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isAdmin: { type: Boolean, default: false }
});

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    text: { type: String, default: '' },
    image: { type: String, default: '' },
    video: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Admin Seeding
async function seedAdmin() {
    try {
        const existing = await User.findOne({ username: ADMIN_USERNAME });
        if (!existing) {
            const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await User.create({
                username: ADMIN_USERNAME,
                number: '-',
                password: hashed,
                passwordPlain: ADMIN_PASSWORD,
                isAdmin: true
            });
            console.log('Admin account initialized:', ADMIN_USERNAME);
        }
    } catch (e) {
        console.error('Admin seed error:', e);
    }
}

// ---------------- Auth Middlewares ----------------
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

const requireAdmin = async (req, res, next) => {
    const user = await User.findOne({ username: req.user.username });
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
};

// ---------------- Auth Routes ----------------
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, number, avatar } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and Password required' });

        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername === ADMIN_USERNAME) return res.status(400).json({ error: 'Reserved username' });

        const existingUser = await User.findOne({ username: cleanUsername });
        if (existingUser) return res.status(400).json({ error: 'Username already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username: cleanUsername,
            password: hashedPassword,
            passwordPlain: password,
            number: number || '',
            avatar: avatar || ''
        });
        await newUser.save();

        const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax' });
        res.json({ message: 'Registration successful', username: cleanUsername, isAdmin: false, avatar: newUser.avatar });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUsername = username.trim().toLowerCase();

        const user = await User.findOne({ username: cleanUsername });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ username: cleanUsername }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax' });
        res.json({ message: 'Login successful', username: cleanUsername, isAdmin: user.isAdmin, avatar: user.avatar });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ username: user.username, isAdmin: user.isAdmin, avatar: user.avatar });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// ---------------- Chat & Messages Routes ----------------
app.get('/api/messages/:targetUser', authenticateToken, async (req, res) => {
    try {
        const current = req.user.username.toLowerCase();
        const target = req.params.targetUser.toLowerCase();

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

app.post('/api/messages/:targetUser', authenticateToken, async (req, res) => {
    try {
        const current = req.user.username.toLowerCase();
        const target = req.params.targetUser.toLowerCase();
        const { text, image, video } = req.body;

        const newMsg = new Message({
            sender: current,
            receiver: target,
            text: text || '',
            image: image || '',
            video: video || '',
            status: 'sent'
        });

        await newMsg.save();

        io.to(target).emit('new-message', newMsg);
        io.to(current).emit('new-message', newMsg);

        res.json(newMsg);
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ---------------- Realtime Socket.IO ----------------
io.on('connection', (socket) => {
    let boundUser = null;

    socket.on('register', (username) => {
        if (!username) return;
        boundUser = String(username).trim().toLowerCase();
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(boundUser);
    });

    const norm = (s) => (s ? String(s).trim().toLowerCase() : s);

    socket.on('typing', ({ to }) => {
        if (!boundUser || !to) return;
        io.to(norm(to)).emit('typing', { from: boundUser });
    });

    socket.on('stop-typing', ({ to }) => {
        if (!boundUser || !to) return;
        io.to(norm(to)).emit('stop-typing', { from: boundUser });
    });

    socket.on('call-user', ({ to, offer, callType }) => {
        io.to(norm(to)).emit('incoming-call', { from: boundUser, offer, callType });
    });

    socket.on('call-accepted', ({ to, answer }) => {
        io.to(norm(to)).emit('call-accepted', { from: boundUser, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(norm(to)).emit('ice-candidate', { from: boundUser, candidate });
    });

    socket.on('call-rejected', ({ to }) => {
        io.to(norm(to)).emit('call-rejected', { from: boundUser });
    });

    socket.on('end-call', ({ to }) => {
        io.to(norm(to)).emit('call-ended', { from: boundUser });
    });
});

// Start Server
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        seedAdmin();
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => console.error('MongoDB connection error:', err));
