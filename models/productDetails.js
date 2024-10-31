const mongoose = require('mongoose');
const qr = require('qrcode'); // Assuming you're using the 'qrcode' library

const productDetailsSchema = new mongoose.Schema({
    manufactureId: {
        type: String,
        required: [true, 'Seller ID is required'],
        trim: true
    },
    manufactureName: {
        type: String,
        trim: true,
    },
    consumerId: {
        type: String,
        required: [true, 'Manufacturer ID is required'],
        trim: true
    },
    consumerName: {
        type: String,
        required: [true, 'Manufacturer name is required'],
        trim: true,
    },

    productName: [
        {
            name: {
                type: String,
                required: [true, 'Medicine name is required'],
                trim: true,
            },
            quantity: {
                type: Number,
                required: [true, 'Medicine quantity is required'],
                min: [0, 'Medicine quantity cannot be negative'],
            },
            price: {
                type: Number,
                required: [true, 'Medicine price is required'],
                min: [0, 'Medicine price cannot be negative'],
            }
        }
    ],
    orderDate:[
    {
        dispatchDate:{
            type: Date,
            required: [true, 'Dispatch Date is required']
        },
        deliveryDate:{
            type: Date,
            required: [true, 'Delivery Date is required']
        }
    }
   ],
    qrCodeImage: {
        type: String // Store the base64-encoded QR code image
    },
    pincode: {
        type: String,
        required: [true, 'Pincode is required'],
        trim: true,
    },
    orderTotal: {
        type: Number,
        default: 0
    },
    SecurityCode: {
        type: String,                                                                                                                                                                                                                      
        required: [true,'Security code is required'],
        trim: true
    },
    complain_id:{
        type: Number,
        default: 0, 
    },
    order_status:{
        type: String,
        default: 'Pending',   
        enum: ['Pending', 'Delivered', 'Cancelled'] 
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

const ProductDetails = mongoose.model('ProductDetails', productDetailsSchema);

module.exports = ProductDetails;