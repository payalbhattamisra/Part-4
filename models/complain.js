const mongoose = require('mongoose');

const ComplainSchema = new mongoose.Schema({
    manufactureId: {
        type: String,
        required: [true, 'Seller ID is required'],
        trim: true
    },
    consumerId: {
        type: String,
        required: [true, 'Manufacturer ID is required'],
        trim: true
    },
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductDetails",
        required: true
    },
     
    product_complain: [
        {
            productName: {
                type: String,  
                required: true
            },
            send_quantity: {
                type: Number,
                required: true
            },
            receive_quantity: {
                type: Number,
                required: true
            },
            complain_category: {
                type: String,
                required: true,
                enum: [
                    'Short Shelf life',
                    'Damaged Goods',
                    'Incorrect Quantity',
                    'Expired Products',
                    'Quality Issues',
                    'Other'
                ]
            }
        }
    ],
    complain_date: {
        type: Date,
        default: Date.now
    },
    complain_status: {
        type: String,
        default: 'Pending',
        enum: ['Pending', 'Resolved', 'Cancelled']
    }
});

module.exports = mongoose.model('Complain', ComplainSchema);
