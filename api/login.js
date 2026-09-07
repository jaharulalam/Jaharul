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

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Ye number register nahi hai' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Password galat hai' });
    }

    return res.status(200).json({ success: true, phone: user.phone });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
