const mongoose = require('mongoose');

/**
 * OptionTrade Strategy Subscription Model
 * Links IIFL users to OptionTrade strategy with lot-based configuration
 */
const OptionTradeSubscriptionSchema = new mongoose.Schema(
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
    
    // OptionTrade-specific configuration
    lotSize: {
      type: Number,
      required: true,
      default: 1, // Number of lots (1 lot = 75 qty for NIFTY)
      min: 1
    },

    // Trading preferences
    allowedSymbols: {
      type: [String],
      default: ['NIFTY', 'NIFTY1!'] // Only NIFTY for OptionTrade
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
OptionTradeSubscriptionSchema.index({ userID: 1, enabled: 1 });

const OptionTradeSubscription = mongoose.model('OptionTradeSubscription', OptionTradeSubscriptionSchema);

module.exports = OptionTradeSubscription;

