const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true
    },
    orderType: {
        type: String,
        required: true
    },
    routeName: String,
    details: {
        script: String,
        price: Number,
        stopLoss: Number,
        originalMessage: String,
        status: Boolean,
        message: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Check if model already exists to prevent OverwriteModelError
module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
