const mongoose = require('mongoose');

const orderResponseSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: true
    },
    broker: {
        type: String,
        required: true,
        enum: ['ANGEL', 'MOTILAL', 'DHAN', 'SHAREKHAN', 'IIFL']
    },
    symbol: {
        type: String,
        required: true
    },
    transactionType: {
        type: String,
        required: true,
        enum: ['BUY', 'SELL']
    },
    orderType: {
        type: String,
        required: true,
        enum: ['MARKET', 'LIMIT', 'STOPLOSS', 'STOPLOSS_MARKET', 'PRIMARY', 'STOP_LOSS']
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'SUCCESS', 'FAILED']
    },
    orderId: String,
    uniqueOrderId: String,
    message: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    response: Object,
    apiKey: String
});

module.exports = mongoose.model('OrderResponse', orderResponseSchema);
