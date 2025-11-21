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
    console.log(`\n🔍 Getting subscribed users for strategy: ${strategy}, symbol: ${symbol || 'N/A'}`);

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

    console.log(`📋 Using subscription model: ${subscriptionModel}`);

    // Get all enabled subscriptions
    const subscriptions = await prisma[subscriptionModel].findMany({ where: { enabled: true } });

    console.log(`📊 Found ${subscriptions.length} enabled subscriptions in database`);

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`⚠️ No users subscribed to ${strategy}`);
      console.log(`   This means either:`);
      console.log(`   1. No subscriptions were created (broker/register failed)`);
      console.log(`   2. All subscriptions are disabled (enabled=false)`);
      console.log(`   3. Wrong strategy name mapping`);
      return [];
    }

    // Get user details with tokens for each subscription
    const users = [];
    console.log(`\n🔄 Processing ${subscriptions.length} subscriptions...`);

    for (const subscription of subscriptions) {
      console.log(`\n  📝 Processing subscription ID: ${subscription.id}, userID: ${subscription.userID}`);

      // Get clientId from subscription customSettings
      const clientId = subscription.customSettings?.clientId || subscription.customSettings?.brokerClientId;

      if (!clientId) {
        console.warn(`  ⚠️ No clientId in subscription for user ${subscription.userID} - SKIPPING`);
        console.warn(`     customSettings:`, subscription.customSettings);
        continue;
      }

      console.log(`  ✅ Found clientId: ${clientId}`);

      // Find broker account from main app database by clientId
      console.log(`  🔍 Looking for broker account with clientId: ${clientId}`);
      const brokerAccount = await prisma.brokerAccount.findFirst({
        where: {
          clientId: clientId,
          isActive: true
        }
      });

      if (!brokerAccount) {
        console.warn(`  ⚠️ No broker account found for clientId ${clientId} - SKIPPING`);
        console.warn(`     Make sure broker account is created in friendly-octo-engine`);
        continue;
      }

      console.log(`  ✅ Found broker account: ${brokerAccount.clientName} (ID: ${brokerAccount.id})`);

      // Find active broker token for this account
      console.log(`  🔍 Looking for active broker token...`);
      const brokerToken = await prisma.brokerToken.findFirst({
        where: {
          brokerAccountId: brokerAccount.id,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!brokerToken) {
        console.error(`  ❌ No active broker token found for ${brokerAccount.clientName} - SKIPPING USER`);
        console.error(`     Make sure to authenticate broker account in friendly-octo-engine`);
        continue;
      }

      // Token is valid - use it
      const token = brokerToken.accessToken;
      const tokenValidity = brokerToken.expiresAt;
      console.log(`  ✅ Found REAL token for ${brokerAccount.clientName} (expires: ${tokenValidity})`);

      // Fix missing lotSize for old subscriptions (set default to 1)
      let lotSize = subscription.lotSize;
      if (!lotSize && strategy !== 'Epicrise') {
        console.log(`  ⚠️ Missing lotSize for ${brokerAccount.clientName} - setting default to 1`);
        lotSize = 1;
        // Update in database
        await prisma[subscriptionModel].updateMany({ where: { userID: subscription.userID }, data: { lotSize: 1 } });
        console.log(`  ✅ Fixed missing lotSize in database`);
      }

      console.log(`  📊 Subscription config:`, {
        strategy,
        symbol,
        lotSize,
        capital: subscription.capital,
        enabled: subscription.enabled
      });

      // Calculate quantity if symbol provided and lotSize exists
      let quantity = null;
      if (symbol && lotSize) {
        quantity = calculateQuantity(symbol, lotSize);
        console.log(`  📈 Calculated quantity: ${quantity} (${lotSize} lots)`);
      } else {
        console.log(`  ⚠️ Cannot calculate quantity - symbol: ${symbol}, lotSize: ${lotSize}`);
      }

      const userData = {
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
      };

      users.push(userData);
      console.log(`  ✅ Added user to execution list: ${brokerAccount.clientName}`);
    }

    console.log(`\n✅ FINAL RESULT: Found ${users.length} users subscribed to ${strategy} with valid tokens`);
    if (users.length > 0) {
      console.log(`   Users ready for execution:`);
      users.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.clientName} (${u.clientId}) - Lot Size: ${u.subscription.lotSize}, Quantity: ${u.subscription.quantity || 'N/A'}`);
      });
    }
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

