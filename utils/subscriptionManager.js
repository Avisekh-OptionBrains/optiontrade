const prisma = require('../prismaClient');
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
        subscriptionModel = 'epicriseSubscription';
        break;
      case 'OptionTrade':
        subscriptionModel = 'optionTradeSubscription';
        break;
      case 'BankNifty':
        subscriptionModel = 'bankNiftySubscription';
        break;
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }

    // Get all enabled subscriptions
    const subscriptions = await prisma[subscriptionModel].findMany({ where: { enabled: true } });

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`⚠️ No users subscribed to ${strategy}`);
      return [];
    }

    // Get user details with tokens for each subscription
    const users = [];
    for (const subscription of subscriptions) {
      // Get clientId from subscription customSettings
      const clientId = subscription.customSettings?.clientId || subscription.customSettings?.brokerClientId;

      if (!clientId) {
        console.warn(`⚠️ No clientId in subscription for user ${subscription.userID} - SKIPPING`);
        continue;
      }

      // Find broker account from main app database by clientId
      const brokerAccount = await prisma.brokerAccount.findFirst({
        where: {
          clientId: clientId,
          isActive: true
        }
      });

      if (!brokerAccount) {
        console.warn(`⚠️ No broker account found for clientId ${clientId} - SKIPPING`);
        continue;
      }

      // Find active broker token for this account
      const brokerToken = await prisma.brokerToken.findFirst({
        where: {
          brokerAccountId: brokerAccount.id,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!brokerToken) {
        console.error(`❌ No active broker token found for ${brokerAccount.clientName} - SKIPPING USER`);
        continue;
      }

      // Token is valid - use it
      const token = brokerToken.accessToken;
      const tokenValidity = brokerToken.expiresAt;
      console.log(`✅ Found REAL token for ${brokerAccount.clientName} (expires: ${tokenValidity})`);

      // Fix missing lotSize for old subscriptions (set default to 1)
      let lotSize = subscription.lotSize;
      if (!lotSize && strategy !== 'Epicrise') {
        lotSize = 1;
        // Update in database
        await prisma[subscriptionModel].updateMany({ where: { userID: subscription.userID }, data: { lotSize: 1 } });
        console.log(`⚠️ Fixed missing lotSize for ${brokerAccount.clientName} - set to 1 lot`);
      }

      console.log(`🔍 Debug for ${brokerAccount.clientName}:`, {
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
        // User credentials (from BrokerAccount)
        userID: subscription.userID,
        clientName: brokerAccount.clientName,
        clientId: brokerAccount.clientId,
        token: token, // REAL broker token
        tokenValidity: tokenValidity,

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
        subscriptionModel = 'epicriseSubscription';
        break;
      case 'OptionTrade':
        subscriptionModel = 'optionTradeSubscription';
        break;
      case 'BankNifty':
        subscriptionModel = 'bankNiftySubscription';
        break;
      default:
        return null;
    }
    
    const subscription = await prisma[subscriptionModel].findFirst({ where: { userID: userID, enabled: true } });
    
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
        subscriptionModel = 'epicriseSubscription';
        break;
      case 'OptionTrade':
        subscriptionModel = 'optionTradeSubscription';
        break;
      case 'BankNifty':
        subscriptionModel = 'bankNiftySubscription';
        break;
      default:
        return;
    }
    
    await prisma[subscriptionModel].updateMany({ where: { userID: userID }, data: { totalTrades: { increment: 1 }, lastTradeDate: new Date() } });
    
  } catch (error) {
    console.error(`❌ Error updating trade stats:`, error.message);
  }
}

module.exports = {
  getSubscribedUsers,
  getUserSubscription,
  updateTradeStats
};

