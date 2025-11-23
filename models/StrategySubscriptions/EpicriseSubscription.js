const mongoose = require('mongoose');

/**
 * Epicrise Strategy Subscription Model
 * Links IIFL users to Epicrise strategy with capital-based configuration
 */
const EpicriseSubscriptionSchema = new mongoose.Schema(
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
    
    // Epicrise-specific configuration
    capital: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Risk management
    maxPositions: {
      type: Number,
      default: 1,
      min: 1
    },
    
    riskPerTrade: {
      type: Number,
      default: 2, // 2% of capital per trade
      min: 0.1,
      max: 10
    },
    
    // Trading preferences
    allowedSymbols: {
      type: [String],
      default: [] // Empty = all symbols allowed
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
EpicriseSubscriptionSchema.index({ userID: 1, enabled: 1 });

const EpicriseSubscription = mongoose.model('EpicriseSubscription', EpicriseSubscriptionSchema);

module.exports = EpicriseSubscription;

