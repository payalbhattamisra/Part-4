 // Import dotenv to load environment variables from .env file
require('dotenv').config();
const mongoose = require('mongoose');

// Use the environment variable for MongoDB URI
const mongoURI = process.env.MONGODB_URI;

// Connect to MongoDB Atlas or fallback to local MongoDB
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch((error) => console.error('Error connecting to MongoDB:', error));

// Define schema
const userSchema = mongoose.Schema({
    userID: String,
    name: String,
    address: String,
    pincode: Number,
    contact_number: Number,
    email: String,
    password: String,
    GST: String,
    total_complaints: Number,
    total_resolved: Number
});

// Export model
module.exports = mongoose.model("usersD", userSchema);
