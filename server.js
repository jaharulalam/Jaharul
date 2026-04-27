const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ================== अपना Connection String यहाँ डालो ==================
const uri = "mongodb+srv://jaharulalam1234:jaharulalam1234@cluster1.m3w4dg5.mongodb.net/?retryWrites=true&w=majority";
// =====================================================================

const client = new MongoClient(uri);

app.post('/register', async (req, res) => {
    try {
        await client.connect();
        const database = client.db("Userdatabase");
        const usersCollection = database.collection("user");

        const newUser = {
            phone: req.body.phone,      // मोबाइल नंबर
            createdAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);

        res.json({ 
            success: true, 
            message: "Number registered successfully",
            insertedId: result.insertedId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while saving number" 
        });
    } finally {
        // await client.close();   // Production में comment रख सकते हो
    }
});

// Health check route
app.get('/', (req, res) => {
    res.send('Backend is running successfully!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});