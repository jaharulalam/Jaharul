const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
// Vercel automatically port handle karta hai
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join('/tmp', 'users_db.json'); // Vercel par temporary storage use karni padti hai
const ADMIN_INVITE_CODE = "BDG100";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './'))); // HTML files serve karne ke liye

// Database Initialization
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

const getDB = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        return {};
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        return false;
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const db = getDB();
    if (db[phone] && db[phone].password === password) {
        res.json({ success: true, userId: phone, balance: db[phone].balance || 0 });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    }
});

app.post('/register', (req, res) => {
    const { phone, password, inviteCode } = req.body;
    let db = getDB();
    if (db[phone]) return res.json({ success: false, message: "User already exists!" });
    
    let bonus = (inviteCode === ADMIN_INVITE_CODE) ? 100.00 : 0.00;
    db[phone] = { password: password, balance: bonus, history: [] };

    if (saveDB(db)) {
        res.json({ success: true, userId: phone, balance: bonus });
    } else {
        res.status(500).json({ success: false, message: "Server Write Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app; // Vercel ke liye zaroori hai
