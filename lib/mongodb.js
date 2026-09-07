const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

// Serverless (Vercel) par har request par naya connection banane se bachne ke liye
// connection ko globally cache karte hain.
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable set nahi hai. Vercel ke Environment Variables me daalo.');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
