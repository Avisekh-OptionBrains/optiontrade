const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
  // Strategy Information
  strategy: {
    type: String,
    required: true,
    enum: ['BB TRAP', 'OTHER'],
    default: 'BB TRAP'
  },
  
  // Signal Information
  signal: {
    action: {
      type: String,
      required: true,
      enum: ['buy', 'sell']
    },
    symbol: {
      type: String,
      required: true
    },
    entryPrice: {
      type: Number,
      required: true
    },
    stopLoss: {
      type: Number,
      required: true
    },
    target: {
      type: Number,
      required: true
    }
  },
  
  // Option Orders
  orders: [{
    type: {
      type: String,
      enum: ['CE', 'PE'],
      required: true
    },
    action: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true
    },
    strike: {
      type: Number,
      required: true
    },
    delta: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    security_id: {
      type: Number,
      required: true
    }
  }],
  
  // Broker Order Results
  results: [{
    success: {
      type: Boolean,
      required: true
    },
    order: {
      type: mongoose.Schema.Types.Mixed
    },
    response: {
      type: mongoose.Schema.Types.Mixed
    },
    error: {
      type: String
    }
  }],
  
  // Trade Status
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
TradeSchema.index({ createdAt: -1 });
TradeSchema.index({ strategy: 1, status: 1 });
TradeSchema.index({ 'signal.symbol': 1 });

const Trade = mongoose.model('Trade', TradeSchema);

module.exports = Trade;

