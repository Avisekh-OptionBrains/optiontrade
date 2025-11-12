const mongoose = require('mongoose');

/**
 * BankNifty Strategy Subscription Model
 * Links IIFL users to BankNifty strategy with lot-based configuration
 */
const BankNiftySubscriptionSchema = new mongoose.Schema(
  {
    // Reference to main IIFL user
    userID: {
      type: String,
      required: true,
      ref: 'IIFLUser'
    },
    
    // Subscription status
    enabled: {
      type: Boolean,
      default: true
    },
    
    // BankNifty-specific configuration
    lotSize: {
      type: Number,
      required: true,
      default: 1, // Number of lots (1 lot = 35 qty for BankNifty)
      min: 1
    },

    // Trading preferences
    allowedSymbols: {
      type: [String],
      default: ['BANKNIFTY', 'BANKNIFTY1!'] // Only BankNifty
    },
    
    // Custom settings
    customSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // Statistics
    totalTrades: {
      type: Number,
      default: 0
    },
    
    lastTradeDate: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);

// Compound index for fast lookups
BankNiftySubscriptionSchema.index({ userID: 1, enabled: 1 });

const BankNiftySubscription = mongoose.model('BankNiftySubscription', BankNiftySubscriptionSchema);

module.exports = BankNiftySubscription;

