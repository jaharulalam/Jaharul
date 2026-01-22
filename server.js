const express = require('express'); 
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // CORS को अलग से डिफाइन करना बेहतर है
const app = express();

// बदलाव 1: Render के लिए पोर्ट को डायनामिक बनाया (Port Fix)
const PORT = process.env.PORT || 3000;

const FOLDER_PATH = __dirname;
const DATA_FILE = path.join(FOLDER_PATH, 'users_db.json');
const ADMIN_INVITE_CODE = "BDG100"; 

app.use(express.json());
app.use(cors()); // सभी ओरिजिन से रिक्वेस्ट स्वीकार करने के लिए

// स्टेटिक फाइल्स (HTML, CSS, JS) को सर्व करने के लिए
app.use(express.static(FOLDER_PATH));

// डेटाबेस फंक्शन
const getDB = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({}));
            return {};
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return data ? JSON.parse(data) : {};
    } catch (err) {
        console.error("DB Read Error:", err);
        return {};
    }
};

const saveDB = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- API Routes ---

// लॉगिन रूट (इसे मैंने और सुरक्षित और स्थिर बनाया है)
app.post('/login', (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ success: false, message: "Missing phone or password" });
        }

        let db = getDB();
        if (db[phone] && db[phone].password === password) {
            console.log(`✅ Login Success: ${phone}`);
            res.json({ 
                success: true, 
                userId: phone, 
                balance: db[phone].balance || 0 
            });
        } else {
            res.status(401).json({ success: false, message: "Wrong Phone or Password" });
        }
    } catch (error) {
        console.error("Login Route Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
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
    const listPath = path.join(FOLDER_PATH, 'admin_upi_list.txt');
    fs.appendFileSync(listPath, adminData);
    res.json({ success: true });
});

// सर्वर चालू करना
app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`✅ सर्वर चालू है! पोर्ट: ${PORT}`);
    console.log(`🌐 यूआरएल: http://localhost:${PORT}`);
    console.log(`========================================`);
});
