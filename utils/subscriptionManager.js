const IIFLUser = require('../models/IIFLUser');
const EpicriseSubscription = require('../models/StrategySubscriptions/EpicriseSubscription');
const OptionTradeSubscription = require('../models/StrategySubscriptions/OptionTradeSubscription');
const BankNiftySubscription = require('../models/StrategySubscriptions/BankNiftySubscription');
const { calculateQuantity } = require('../constants/lotSizes');

/**
 * Get all users subscribed to a specific strategy
 * @param {string} strategy - 'Epicrise', 'OptionTrade', or 'BankNifty'
 * @param {string} symbol - Trading symbol (optional, for quantity calculation)
 * @returns {Array} - Array of users with their subscription config and token
 */
async function getSubscribedUsers(strategy, symbol = null) {
  try {
    let subscriptionModel;
    
    switch (strategy) {
      case 'Epicrise':
        subscriptionModel = EpicriseSubscription;
        break;
      case 'OptionTrade':
        subscriptionModel = OptionTradeSubscription;
        break;
      case 'BankNifty':
        subscriptionModel = BankNiftySubscription;
        break;
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
    
    // Get all enabled subscriptions
    const subscriptions = await subscriptionModel.find({ enabled: true });
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`⚠️ No users subscribed to ${strategy}`);
      return [];
    }
    
    // Get user details with tokens for each subscription
    const users = [];
    for (const subscription of subscriptions) {
      const user = await IIFLUser.findOne({ 
        userID: subscription.userID,
        state: 'live' // Only active users
      });
      
      if (user && user.token) {
        // Fix missing lotSize for old subscriptions (set default to 1)
        let lotSize = subscription.lotSize;
        if (!lotSize && strategy !== 'Epicrise') {
          lotSize = 1;
          // Update in database
          await subscriptionModel.updateOne(
            { userID: subscription.userID },
            { lotSize: 1 }
          );
          console.log(`⚠️ Fixed missing lotSize for ${user.clientName} - set to 1 lot`);
        }

        console.log(`🔍 Debug for ${user.clientName}:`, {
          strategy,
          symbol,
          lotSize,
          subscriptionLotSize: subscription.lotSize
        });

        // Calculate quantity if symbol provided and lotSize exists
        let quantity = null;
        if (symbol && lotSize) {
          quantity = calculateQuantity(symbol, lotSize);
        } else {
          console.log(`⚠️ Cannot calculate quantity - symbol: ${symbol}, lotSize: ${lotSize}`);
        }

        users.push({
          // User credentials (from IIFLUser)
          userID: user.userID,
          clientName: user.clientName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          token: user.token, // SHARED TOKEN
          state: user.state,

          // Strategy-specific config (from subscription)
          subscription: {
            capital: subscription.capital,
            lotSize: lotSize, // Number of lots
            quantity: quantity, // Calculated quantity (lots × lot size)
            maxPositions: subscription.maxPositions,
            riskPerTrade: subscription.riskPerTrade,
            targetDelta: subscription.targetDelta,
            allowedSymbols: subscription.allowedSymbols,
            customSettings: subscription.customSettings
          }
        });
      }
    }
    
    console.log(`✅ Found ${users.length} users subscribed to ${strategy}`);
    return users;
    
  } catch (error) {
    console.error(`❌ Error getting subscribed users for ${strategy}:`, error.message);
    return [];
  }
}

/**
 * Check if a user is subscribed to a strategy
 * @param {string} userID - IIFL user ID
 * @param {string} strategy - Strategy name
 * @returns {Object|null} - Subscription object or null
 */
async function getUserSubscription(userID, strategy) {
  try {
    let subscriptionModel;
    
    switch (strategy) {
      case 'Epicrise':
        subscriptionModel = EpicriseSubscription;
        break;
      case 'OptionTrade':
        subscriptionModel = OptionTradeSubscription;
        break;
      case 'BankNifty':
        subscriptionModel = BankNiftySubscription;
        break;
      default:
        return null;
    }
    
    const subscription = await subscriptionModel.findOne({ 
      userID: userID,
      enabled: true 
    });
    
    return subscription;
    
  } catch (error) {
    console.error(`❌ Error checking subscription:`, error.message);
    return null;
  }
}

/**
 * Update subscription statistics after trade
 * @param {string} userID - IIFL user ID
 * @param {string} strategy - Strategy name
 */
async function updateTradeStats(userID, strategy) {
  try {
    let subscriptionModel;
    
    switch (strategy) {
      case 'Epicrise':
        subscriptionModel = EpicriseSubscription;
        break;
      case 'OptionTrade':
        subscriptionModel = OptionTradeSubscription;
        break;
      case 'BankNifty':
        subscriptionModel = BankNiftySubscription;
        break;
      default:
        return;
    }
    
    await subscriptionModel.updateOne(
      { userID: userID },
      { 
        $inc: { totalTrades: 1 },
        $set: { lastTradeDate: new Date() }
      }
    );
    
  } catch (error) {
    console.error(`❌ Error updating trade stats:`, error.message);
  }
}

module.exports = {
  getSubscribedUsers,
  getUserSubscription,
  updateTradeStats
};

