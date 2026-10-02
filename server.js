const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// आपकी MongoDB कनेक्शन स्ट्रिंग
const mongoURI = 'mongodb+srv://jaharula20_db_user:jhsjM9UPiyflzxeh@cluster0.e5v95rf.mongodb.net/chatapp?appName=Cluster0';

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB successfully connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const DataSchema = new mongoose.Schema({
    info: String,
    date: { type: Date, default: Date.now }
});
const DataModel = mongoose.model('Data', DataSchema);

// रूट राउट जो index.html को सर्व करेगा
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/data', async (req, res) => {
    try {
        const newData = new DataModel(req.body);
        await newData.save();
        res.status(200).json({ message: 'Data saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
