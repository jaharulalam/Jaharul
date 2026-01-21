const express = require('express'); // 'Const' को 'const' किया
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// यह आपके 'BDG GAME' फोल्डर का सही रास्ता अपने आप पकड़ लेगा
const FOLDER_PATH = __dirname;
const DATA_FILE = path.join(FOLDER_PATH, 'users_db.json');
const ADMIN_INVITE_CODE = "BDG100"; 

app.use(express.json());
app.use(require('cors')());

// ब्राउज़र में HTML/CSS फाइल्स दिखाने के लिए यह सबसे जरूरी लाइन है
app.use(express.static(FOLDER_PATH));

// डेटाबेस से जानकारी पढ़ने के लिए
const getDB = () => {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
};

// डेटाबेस में जानकारी सुरक्षित करने के लिए
const saveDB = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// --- API Routes ---

// UPI जानकारी एडमिन के लिए सेव करना
app.post('/save-upi', (req, res) => {
    const { name, phone, upi } = req.body;
    const adminData = `Time: ${new Date().toLocaleString()} | Name: ${name} | Phone: ${phone} | UPI ID: ${upi}\n`;
    const listPath = path.join(FOLDER_PATH, 'admin_upi_list.txt');
    fs.appendFileSync(listPath, adminData);
    res.json({ success: true });
});

// नया यूजर रजिस्टर करना
app.post('/register', (req, res) => {
    const { phone, password, inviteCode } = req.body;
    let db = getDB();
    if (db[phone]) return res.json({ success: false, message: "User already exists!" });
    
    let bonus = (inviteCode === ADMIN_INVITE_CODE) ? 100.00 : 0.00;
    db[phone] = { password, balance: bonus, history: [] };
    saveDB(db);
    res.json({ success: true, userId: phone, balance: bonus });
});

// यूजर लॉगिन करना
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    let db = getDB();
    if (db[phone] && db[phone].password === password) {
        res.json({ success: true, userId: phone, balance: db[phone].balance });
    } else {
        res.json({ success: false, message: "Wrong Phone or Password" });
    }
});

// सर्वर को चालू करना
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`✅ सर्वर सफलतापूर्वक चालू हो गया है!`);
    console.log(`🌐 रजिस्टर पेज खोलें: http://localhost:${PORT}/register.html`);
    console.log(`========================================`);
});
