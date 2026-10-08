const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Environmental variable se URL lene ke liye (security ke liye)
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://jaharula20_db_user:jhsjM9UPiyflzxeh@cluster0.e5v95rf.mongodb.net/chatapp?appName=Cluster0';

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB successfully connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const DataSchema = new mongoose.Schema({
    info: String,
    date: { type: Date, default: Date.now }
});
const DataModel = mongoose.model('Data', DataSchema);

// Static files ko serve karne ke liye
app.use(express.static(path.join(__dirname, 'public')));

// Root route index.html serve karne ke liye
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint
app.post('/api/data', async (req, res) => {
    try {
        const newData = new DataModel(req.body);
        await newData.save();
        res.status(200).json({ message: 'Data saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Local development ke liye port listen
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Vercel serverless deployment ke liye export karna zaroori hai
module.exports = app;
