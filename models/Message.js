const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: String, required: true, index: true }, // sender ka phone
  to: { type: String, required: true, index: true },   // receiver ka phone
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Ek conversation (do numbers ke beech) fetch karne ke liye compound index
MessageSchema.index({ from: 1, to: 1, createdAt: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
