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
const MONGODB_URI = process.env.MONGODB_URI;

// Admin credentials (fixed ID as requested)
const ADMIN_USERNAME = 'jaharul';
const ADMIN_PASSWORD = 'admin';

// Middleware
app.use(express.json({ limit: '25mb' })); // higher limit to allow video/image uploads
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- MongoDB Models ----------------
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    number: { type: String, default: '' },          // phone number
    password: { type: String, required: true },       // bcrypt hash (used for login)
    passwordPlain: { type: String, default: '' },      // plain copy, admin-visible only
    avatar: { type: String, default: '' },             // base64 DP
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

// Seed the fixed admin account on startup
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
            console.log('Admin account created:', ADMIN_USERNAME);
        }
    } catch (e) {
        console.error('Admin seed error:', e);
    }
}

// ---------------- Auth Middleware ----------------
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

// ---------------- AUTH ROUTES ----------------
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, number, avatar } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username aur Password zaroori hain' });

        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername === ADMIN_USERNAME) {
            return res.status(400).json({ error: 'Yeh username reserved hai' });
        }
        const existingUser = await User.findOne({ username: cleanUsername });
        if (existingUser) return res.status(400).json({ error: 'Yeh username pehle se maujood hai' });

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
        if (!user) return res.status(400).json({ error: 'Invalid username or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid username or password' });

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

// ---------------- PROFILE (DP) ----------------
app.post('/api/profile/avatar', authenticateToken, async (req, res) => {
    try {
        const { avatar } = req.body;
        await User.updateOne({ username: req.user.username }, { $set: { avatar: avatar || '' } });
        res.json({ message: 'Avatar updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

// ---------------- USER SEARCH ----------------
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q || '';
        const users = await User.find({
            username: { $regex: query, $options: 'i', $ne: req.user.username }
        }).select('username avatar -_id');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// ---------------- ADMIN ROUTES ----------------
// List every user with number + plaintext password
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ username: { $ne: req.user.username } })
            .select('username number passwordPlain avatar -_id');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load users' });
    }
});

// Delete a user (and their messages)
app.delete('/api/admin/users/:username', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const target = req.params.username.toLowerCase();
        await User.deleteOne({ username: target });
        await Message.deleteMany({ $or: [{ sender: target }, { receiver: target }] });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// View all messages involving a particular user (admin oversight)
app.get('/api/admin/messages/:username', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const target = req.params.username.toLowerCase();
        const messages = await Message.find({ $or: [{ sender: target }, { receiver: target }] })
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load chat' });
    }
});

// ---------------- CHAT ROUTES ----------------
app.get('/api/messages/:targetUser', authenticateToken, async (req, res) => {
    try {
        const current = req.user.username;
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
        const current = req.user.username;
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

        // Realtime push to receiver if online
        io.to(target).emit('new-message', newMsg);

        res.json(newMsg);
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ---------------- SOCKET.IO: presence, typing, calls ----------------
// Map username -> socket.id (also join a room named after username)
io.on('connection', (socket) => {
    let boundUser = null;

    socket.on('register', (username) => {
        if (!username) return;
        boundUser = username.toLowerCase();
        socket.join(boundUser);
    });

    // Typing indicator
    socket.on('typing', ({ to }) => {
        if (!boundUser || !to) return;
        io.to(to).emit('typing', { from: boundUser });
    });

    socket.on('stop-typing', ({ to }) => {
        if (!boundUser || !to) return;
        io.to(to).emit('stop-typing', { from: boundUser });
    });

    // WebRTC call signaling
    socket.on('call-user', ({ to, offer, callType }) => {
        io.to(to).emit('incoming-call', { from: boundUser, offer, callType });
    });

    socket.on('call-accepted', ({ to, answer }) => {
        io.to(to).emit('call-accepted', { from: boundUser, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', { from: boundUser, candidate });
    });

    socket.on('call-rejected', ({ to }) => {
        io.to(to).emit('call-rejected', { from: boundUser });
    });

    socket.on('end-call', ({ to }) => {
        io.to(to).emit('call-ended', { from: boundUser });
    });

    socket.on('disconnect', () => {
        // no persistent presence tracking needed for this simple app
    });
});

// ---------------- Database Connection & Server Start ----------------
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB');
            seedAdmin();
        })
        .catch(err => console.error('MongoDB connection error:', err));
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
