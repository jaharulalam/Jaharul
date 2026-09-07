const connectDB = require('../lib/mongodb');
const User = require('../models/User');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method allowed nahi hai' });
  }

  try {
    await connectDB();
    const exclude = req.query.exclude || '';

    const users = await User.find(
      exclude ? { phone: { $ne: exclude } } : {},
      { phone: 1, _id: 0 }
    ).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, users: users.map((u) => u.phone) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
