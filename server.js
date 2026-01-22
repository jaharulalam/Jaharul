const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'users_db.json');
const ADMIN_INVITE_CODE = "BDG100";

// --- Middleware ---
// CORS को ऐसे सेट किया गया है ताकि किसी भी ओरिजिन से रिक्वेस्ट आ सके
app.use(cors());
app.use(express.json());

// --- Database Initializer ---
// सुनिश्चित करें कि फाइल मौजूद है और खाली नहीं है
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

// Database Helper Functions
const getDB = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        console.error("Read Error:", err);
        return {};
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error("Save Error:", err);
        return false;
    }
};

// --- API Routes ---

// Health Check
app.get('/', (req, res) => {
    res.status(200).send("Server is Running Live on Render!");
});

// लॉगिन रूट
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ success: false, message: "Phone and Password are required" });
    }

    const db = getDB();
    if (db[phone] && db[phone].password === password) {
        res.json({ 
            success: true, 
            userId: phone, 
            balance: db[phone].balance || 0 
        });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    }
});

// रजिस्टर रूट
app.post('/register', (req, res) => {
    const { phone, password, inviteCode } = req.body;
    if (!phone || !password) {
        return res.status(400).json({ success: false, message: "Fill all details" });
    }

    let db = getDB();
    if (db[phone]) {
        return res.json({ success: false, message: "User already exists!" });
    }
    
    // Bonus Logic
    let bonus = (inviteCode === ADMIN_INVITE_CODE) ? 100.00 : 0.00;
    
    db[phone] = { 
        password: password, 
        balance: bonus, 
        history: [] 
    };

    if (saveDB(db)) {
        res.json({ success: true, userId: phone, balance: bonus });
    } else {
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

// UPI सेव करना (Admin List)
app.post('/save-upi', (req, res) => {
    const { name, phone, upi } = req.body;
    if (!phone || !upi) {
        return res.status(400).json({ success: false, message: "Missing Data" });
    }

    const adminData = `Time: ${new Date().toLocaleString()} | Name: ${name} | Phone: ${phone} | UPI ID: ${upi}\n`;
    const listPath = path.join(__dirname, 'admin_upi_list.txt');

    try {
        fs.appendFileSync(listPath, adminData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "File Save Error" });
    }
});

// --- Server Start ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server successfully started on port ${PORT}`);
});
