const bcrypt = require('bcryptjs');
const connectDB = require('../lib/mongodb');
const User = require('../models/User');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method allowed nahi hai' });
  }

  try {
    await connectDB();
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Number aur password dono chahiye' });
    }

    const existing = await User.findOne({ phone: phone.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Ye number pehle se register hai' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ phone: phone.trim(), password: hashed });

    return res.status(201).json({ success: true, phone: user.phone });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
