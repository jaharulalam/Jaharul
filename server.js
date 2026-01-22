const express = require('express'); 
const fs = require('fs');
const path = require('path');
const cors = require('cors'); 
const app = express();

// Render ke liye Port setup
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'users_db.json');
const ADMIN_INVITE_CODE = "BDG100"; 

// Badlav: CORS ko thoda open kiya taaki GitHub se request block na ho
app.use(cors()); 
app.use(express.json());

// Pehle check karein ki DB file hai ya nahi
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// Database functions
const getDB = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return data ? JSON.parse(data) : {};
    } catch (err) {
        return {};
    }
};

const saveDB = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- API Routes ---

// Default Route (Check karne ke liye ki server chal raha hai)
app.get('/', (req, res) => {
    res.send("Server is Running Live on Render!");
});

// लॉगिन रूट
app.post('/login', (req, res) => {
    try {
        const { phone, password } = req.body;
        let db = getDB();
        if (db[phone] && db[phone].password === password) {
            res.json({ 
                success: true, 
                userId: phone, 
                balance: db[phone].balance || 0 
            });
        } else {
            res.status(401).json({ success: false, message: "Wrong Phone or Password" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// रजिस्टर रूट
app.post('/register', (req, res) => {
    const { phone, password, inviteCode } = req.body;
    let db = getDB();
    if (db[phone]) return res.json({ success: false, message: "User already exists!" });
    
    let bonus = (inviteCode === ADMIN_INVITE_CODE) ? 100.00 : 0.00;
    db[phone] = { password, balance: bonus, history: [] };
    saveDB(db);
    res.json({ success: true, userId: phone, balance: bonus });
});

// UPI सेव करना
app.post('/save-upi', (req, res) => {
    const { name, phone, upi } = req.body;
    const adminData = `Time: ${new Date().toLocaleString()} | Name: ${name} | Phone: ${phone} | UPI ID: ${upi}\n`;
    const listPath = path.join(__dirname, 'admin_upi_list.txt');
    fs.appendFileSync(listPath, adminData);
    res.json({ success: true });
});

// सर्वर चालू करना (Render ke liye 0.0.0.0 zaroori hai)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server started on port ${PORT}`);
});
