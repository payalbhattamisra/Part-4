const mongoose = require('mongoose');
const ConsumerSchema = new mongoose.Schema({
    hospital_name: {
        type: String,
        required: true
    },
    consumer_email: {
        type: String,
        required: true,
        unique: true
    },
    consumer_password: {
        type: String,
        required: true
    },
    location: { // Ensure lowercase to match frontend naming
        type: String,
        required: true
    },
    pincode: {
        type: Number,
        required: true
    },
    hospital_license_no: { // Consistent lowercase naming
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('Consumer', ConsumerSchema);
