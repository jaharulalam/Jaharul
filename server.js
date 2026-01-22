const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE CONNECTION (Aapke password ke saath) ---
const mongoURI = "mongodb+srv://alluserdatabase:alluserdatabase@cluster0.wudrz8f.mongodb.net/bdgGame?retryWrites=true&w=majority"; 

mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Connected Successfully!"))
    .catch(err => console.log("MongoDB Connection Error:", err));

// User Schema (Database mein data save karne ke liye)
const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Registration API
app.post('/api/register', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const newUser = new User({ phone, password });
        await newUser.save();
        res.json({ success: true, message: "Account Created!" });
    } catch (err) {
        res.status(400).json({ success: false, message: "Phone number already exists!" });
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone, password });
    if (user) {
        res.json({ success: true, balance: user.balance });
    } else {
        res.status(401).json({ success: false, message: "Invalid Details!" });
    }
});

// Frontend Files Serving
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
