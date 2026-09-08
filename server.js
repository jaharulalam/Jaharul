require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' })); // big enough for base64 photos
app.use(cookieParser());

// ---------- DB models (all in this one file) ----------
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }
}));

const Contact = mongoose.models.Contact || mongoose.model('Contact', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, trim: true },
  owner: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}));

const Message = mongoose.models.Message || mongoose.model('Message', new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  owner: { type: String, required: true },
  text: { type: String, default: '' },
  image: { type: String, default: null },
  type: { type: String, default: 'sent' },
  createdAt: { type: Date, default: Date.now }
}));

// ---------- DB connection ----------
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
  console.log('MongoDB connected');
}
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { console.error(err.message); res.status(500).json({ error: 'Database connection failed' }); }
});

// ---------- Auth helper ----------
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// One-time: create the login user automatically if it doesn't exist yet,
// using ADMIN_USERNAME / ADMIN_PASSWORD from .env. Runs on server start,
// so you don't need a separate seed script/file.
async function ensureAdminUser() {
  await connectDB();
  const username = process.env.ADMIN_USERNAME || 'admin';
  const existing = await User.findOne({ username });
  if (existing) return;
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'changeme123', 10);
  await User.create({ username, passwordHash });
  console.log(`Created login user "${username}" from .env`);
}

// ---------- Auth routes ----------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ success: true, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    res.json({ username: jwt.verify(token, process.env.JWT_SECRET).username });
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});

// ---------- Contact routes ----------
app.get('/api/contacts', requireAuth, async (req, res) => {
  const contacts = await Contact.find({ owner: req.user.username }).sort({ createdAt: -1 });
  res.json(contacts);
});

app.post('/api/contacts', requireAuth, async (req, res) => {
  const { name, number } = req.body;
  if (!name || !number) return res.status(400).json({ error: 'Name and number required' });

  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await Contact.findOne({ owner: req.user.username, name: new RegExp(`^${escaped}$`, 'i') });
  if (existing) return res.status(409).json({ error: 'Is naam se contact pehle se saved hai!' });

  const contact = await Contact.create({ name: name.trim(), number: number.trim(), owner: req.user.username });
  res.json(contact);
});

// ---------- Message routes ----------
app.get('/api/messages/:contactId', requireAuth, async (req, res) => {
  const messages = await Message.find({ contactId: req.params.contactId, owner: req.user.username }).sort({ createdAt: 1 });
  res.json(messages);
});

app.post('/api/messages/:contactId', requireAuth, async (req, res) => {
  const { text, image } = req.body;
  if (!text && !image) return res.status(400).json({ error: 'Text or image required' });

  const message = await Message.create({
    contactId: req.params.contactId,
    owner: req.user.username,
    text: text || '',
    image: image || null,
    type: 'sent'
  });
  res.json(message);
});

// ---------- Static frontend (single index.html handles login + chat) ----------
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ---------- Start ----------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  ensureAdminUser().finally(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  });
}

module.exports = app;
