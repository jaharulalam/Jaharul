const connectDB = require('../lib/mongodb');
const Message = require('../models/Message');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method === 'GET') {
      const { user1, user2, after } = req.query;
      if (!user1 || !user2) {
        return res.status(400).json({ success: false, message: 'user1 aur user2 dono chahiye' });
      }

      const query = {
        $or: [
          { from: user1, to: user2 },
          { from: user2, to: user1 },
        ],
      };
      if (after) {
        query.createdAt = { +gt: new Date(after) };
      }

      const messages = await Message.find(query).sort({ createdAt: 1 });
      return res.status(200).json({ success: true, messages });
    }

    if (req.method === 'POST') {
      const { from, to, text } = req.body;
      if (!from || !to || !text || !text.trim()) {
        return res.status(400).json({ success: false, message: 'from, to aur text zaroori hai' });
      }

      const message = await Message.create({ from, to, text: text.trim() });
      return res.status(201).json({ success: true, message });
    }

    return res.status(405).json({ success: false, message: 'Method allowed nahi hai' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
