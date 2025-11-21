const axios = require("axios");
const IIFLUser = require("../../../../models/IIFLUser");
const { findSymbolInDatabase } = require("../../../../newdb");

// IIFL API Base URL (Updated)
const IIFL_BASE_URL = "https://api.iiflcapital.com/v1";

/**
 * Place order for a single IIFL user
 * @param {Object} user - IIFL user object
 * @param {string} symbol - Trading symbol
 * @param {string} action - BUY or SELL
 * @param {number} price - Order price
 * @param {number} stopLoss - Stop loss price
 * @returns {Object} - Order response
 */
async function placeOrderForUser(user, symbol, action, price, stopLoss) {
  const { clientName, token, userID, tokenValidity } = user;
  const capital = (user && user.subscription && user.subscription.capital != null) ? user.subscription.capital : user.capital;

  console.log(`📊 IIFL Client Details:`);
  console.log(`   👤 Name: ${clientName}`);
  console.log(`   💰 Capital: ₹${capital ? capital.toLocaleString() : 'N/A'}`);
  console.log(`   🔑 Has Token: ${!!token}`);
  console.log(`   🔑 Token Length: ${token ? token.length : 0} chars`);
  console.log(`   👤 User ID: ${userID}`);

  // REAL TRADING ONLY - Validate token is present and valid
  if (!token) {
    console.error(`❌ IIFL user ${clientName} missing session token - CANNOT PLACE ORDER`);
    return { success: false, error: `Missing session token for ${clientName}`, user: clientName };
  }

  if (tokenValidity && new Date(tokenValidity) <= new Date()) {
    console.error(`❌ IIFL user ${clientName} token expired - CANNOT PLACE ORDER`);
    return { success: false, error: `Token expired for ${clientName}`, user: clientName };
  }

  // Check if token is still valid (optional check - cron job handles this)
  if (tokenValidity && new Date() > new Date(tokenValidity)) {
    console.warn(`⚠️ IIFL user ${clientName} has expired token, but proceeding with order`);
  }

  // Login status check removed - cron job handles login, just proceed with order placement

  try {
    // Calculate quantity based on capital and price
    const quantity = Math.floor(capital / price);
    
    if (quantity <= 0) {
      console.log(`⚠️ Insufficient capital for ${clientName}. Required: ₹${price}, Available: ₹${capital}`);
      return { success: false, error: `Insufficient capital for ${clientName}` };
    }

    console.log(`📈 Placing ${action} order for ${quantity} shares of ${symbol} at ₹${price}`);

    // Get instrument ID from database
    let instrumentId;
    try {
      instrumentId = await getInstrumentID(symbol);
    } catch (error) {
      console.error(`❌ IIFL: Failed to get instrument ID for ${symbol}:`, error.message);
      return {
        success: false,
        error: `Failed to get instrument ID for ${symbol}: ${error.message}`,
        clientName: clientName
      };
    }

    // IIFL Order payload (Updated format based on new API documentation)
    const orderPayload = [{
      instrumentId: instrumentId, // Instrument ID from database lookup
      exchange: "NSEEQ", // Exchange segment
      transactionType: action.toUpperCase(), // BUY or SELL
      quantity: quantity.toString(), // Quantity as string
      orderComplexity: "REGULAR", // Order complexity
      product: "INTRADAY", // Product type
      orderType: "LIMIT", // Order type
      validity: "DAY", // Validity
      price: parseFloat(price).toString(), // Price as string
      apiOrderSource: "EpicriseTrading", // API source identifier
      orderTag: `Epicrise_${symbol}_${Date.now()}` // Custom order tag
    }];

    console.log(`📡 IIFL Raw Request Payload for ${clientName}:`);
    console.log(JSON.stringify(orderPayload, null, 2));
    console.log(`🔗 IIFL API URL: ${IIFL_BASE_URL}/orders`);
    console.log(`🔑 IIFL Authorization Token: ${token ? `Bearer ${token.substring(0, 20)}...` : 'MISSING'}`);
    console.log(`📤 IIFL Request Headers:`);
    console.log(JSON.stringify({
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token.substring(0, 20)}...` : 'MISSING'
    }, null, 2));

    // Place order via IIFL API (Updated endpoint)
    console.log(`🚀 Sending IIFL order request for ${clientName}...`);
    const response = await axios.post(
      `${IIFL_BASE_URL}/orders`,
      orderPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      }
    );

    console.log(`✅ IIFL Raw Order Response for ${clientName}:`);
    console.log(`📊 Status Code: ${response.status}`);
    console.log(`📊 Status Text: ${response.statusText}`);
    console.log(`📊 Response Headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`📊 Raw Response Data:`, JSON.stringify(response.data, null, 2));

    // Save successful order response to database
    try {
      const { prisma } = require("../../../../prismaClient");

      const orderIdValue = response.data?.data?.orderNumber || response.data?.orderNumber || null;
      const uniqueOrderIdValue = response.data?.data?.exchangeOrderId || response.data?.exchangeOrderId || null;

      await prisma.orderResponse.create({
        data: {
          clientName: clientName,
          broker: "IIFL",
          symbol: symbol,
          transactionType: action.toUpperCase(),
          orderType: "LIMIT",
          price: price,
          quantity: quantity,
          status: "SUCCESS",
          orderId: orderIdValue,
          uniqueOrderId: uniqueOrderIdValue,
          message: `Epicrise ${action} ${symbol}`,
          response: response.data,
          timestamp: new Date()
        }
      });
      console.log(`💾 Order response saved to database for ${clientName} - Status: SUCCESS`);
    } catch (dbError) {
      console.error(`❌ Error saving order response to database for ${clientName}:`, dbError.message);
    }

    // Place stop loss order if provided
    if (stopLoss && stopLoss > 0) {
      console.log(`🛡️ IIFL - Preparing stop loss order at ₹${stopLoss}`);

      setTimeout(async () => {
        try {
          console.log("🛑 IIFL - Creating stop-loss order with proper tick size");

          // Calculate proper trigger and limit prices with tick size rounding
          const triggerPrice = roundToTwoDecimalsEndingInZero(stopLoss);

          // Set limit price slightly worse than trigger price to ensure execution
          // For SELL stop loss (when original was BUY), set price slightly below trigger
          // For BUY stop loss (when original was SELL), set price slightly above trigger
          let limitPrice;
          const stopLossTransactionType = action.toUpperCase() === "BUY" ? "SELL" : "BUY";

          if (stopLossTransactionType === "SELL") {
            // For SELL stop loss, set limit price 0.25% below trigger price
            limitPrice = triggerPrice * 0.9975;
          } else {
            // For BUY stop loss, set limit price 0.25% above trigger price
            limitPrice = triggerPrice * 1.0025;
          }

          // Round the limit price to proper tick size
          const roundedLimitPrice = roundToTwoDecimalsEndingInZero(limitPrice);

          console.log(`🔧 IIFL Stop-loss price calculation:`);
          console.log(`   Original Stop Loss: ₹${stopLoss}`);
          console.log(`   Trigger Price (rounded): ₹${triggerPrice}`);
          console.log(`   Limit Price (${stopLossTransactionType}): ₹${roundedLimitPrice}`);
          console.log(`   Transaction Type: ${action.toUpperCase()} → ${stopLossTransactionType}`);

          // Use the same instrumentId that was already looked up for the primary order
          const stopLossPayload = [{
            instrumentId: instrumentId, // Reuse the instrumentId from primary order
            exchange: "NSEEQ",
            transactionType: stopLossTransactionType,
            quantity: quantity.toString(),
            orderComplexity: "REGULAR",
            product: "INTRADAY",
            orderType: "SL", // Stop Loss order type
            validity: "DAY",
            price: roundedLimitPrice.toString(), // Limit price (execution price)
            slTriggerPrice: triggerPrice.toString(), // Trigger price (activation price)
            apiOrderSource: "EpicriseTrading",
            orderTag: `Epicrise_SL_${symbol}_${Date.now()}`
          }];

          console.log("📋 IIFL Stop-loss order payload:");
          console.log(JSON.stringify(stopLossPayload, null, 2));

          const slResponse = await axios.post(
            `${IIFL_BASE_URL}/orders`,
            stopLossPayload,
            {
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              }
            }
          );

          console.log(`✅ IIFL stop loss order placed for ${clientName}:`, JSON.stringify(slResponse.data, null, 2));
        } catch (slError) {
          console.error(`❌ Error placing stop loss for ${clientName}:`, slError.response?.data || slError.message);
        }
      }, 5000); // 5 second delay for stop loss
    }

    return {
      success: true,
      data: response.data,
      user: clientName,
      quantity: quantity,
      price: price
    };

  } catch (error) {
    console.error(`❌ IIFL Raw Order Error Response for ${clientName}:`);
    console.error(`   🔴 HTTP Status: ${error.response?.status || 'Unknown'}`);
    console.error(`   📝 Status Text: ${error.response?.statusText || 'Unknown'}`);
    console.error(`   📊 Raw Error Response Data:`);
    console.error(JSON.stringify(error.response?.data, null, 2));
    console.error(`   📊 Response Headers:`);
    console.error(JSON.stringify(error.response?.headers, null, 2));
    console.error(`   🔗 Request URL: ${error.config?.url || 'Unknown'}`);
    console.error(`   📤 Raw Request Data:`);
    console.error(JSON.stringify(error.config?.data, null, 2));
    console.error(`   🔑 Request Headers:`);
    console.error(JSON.stringify(error.config?.headers, null, 2));
    console.error(`   💥 Error Message: ${error.message}`);
    console.error(`   📚 Full Error Object:`, JSON.stringify({
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    }, null, 2));

    // Save failed order response to database
    try {
      const { prisma } = require("../../../../prismaClient");

      await prisma.orderResponse.create({
        data: {
          clientName: clientName,
          broker: "IIFL",
          symbol: symbol,
          transactionType: action.toUpperCase(),
          orderType: "LIMIT",
          price: price,
          quantity: quantity,
          status: "FAILED",
          orderId: null,
          uniqueOrderId: null,
          message: `Epicrise ${action} ${symbol} - FAILED`,
          response: { error: error.response?.data || error.message },
          timestamp: new Date()
        }
      });
      console.log(`💾 Failed order response saved to database for ${clientName}`);
    } catch (dbError) {
      console.error(`❌ Error saving failed order response to database for ${clientName}:`, dbError.message);
    }

    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.description || error.message,
      user: clientName,
      statusCode: error.response?.status,
      responseData: error.response?.data,
      fullErrorResponse: error.response?.data
    };
  }
}

/**
 * Get instrument ID for a symbol from database
 * @param {string} symbol - Trading symbol (e.g., "SAMMAANCAP")
 * @returns {number} - Instrument ID (token from database)
 */
async function getInstrumentID(symbol) {
  try {
    console.log(`🔍 IIFL: Looking up instrument ID for symbol: ${symbol}`);

    // First, try to find the symbol in the database
    const document = await findSymbolInDatabase(symbol);

    if (document && document.token) {
      const instrumentID = parseInt(document.token);
      console.log(`✅ IIFL Symbol Mapping (Database): ${symbol} -> ${instrumentID} (from ${document.symbol})`);
      return instrumentID;
    }

    // If symbol not found in database, throw an error
    console.error(`❌ IIFL: Symbol ${symbol} not found in database`);
    throw new Error(`Symbol ${symbol} not found in database. Cannot place order with unknown instrument ID.`);

  } catch (error) {
    console.error(`❌ IIFL: Error looking up instrument ID for ${symbol}:`, error.message);
    throw new Error(`Failed to get instrument ID for ${symbol}: ${error.message}`);
  }
}

/**
 * Place orders for all IIFL users
 * @param {string} symbol - Trading symbol
 * @param {string} action - BUY or SELL
 * @param {number} price - Order price
 * @param {number} stopLoss - Stop loss price
 * @returns {Array} - Array of order responses
 */
async function placeOrdersForAllUsers(symbol, action, price, stopLoss) {
  try {
    console.log(`🔄 Processing IIFL orders for ${symbol} - ${action} at ₹${price}`);
    
    // Fetch all IIFL users
    const users = await IIFLUser.find({ state: "live" });
    
    if (!users || users.length === 0) {
      console.log("⚠️ No IIFL users found");
      return [];
    }

    console.log(`📊 Found ${users.length} IIFL users`);

    const results = [];
    
    // Process each user
    for (const user of users) {
      const result = await placeOrderForUser(user, symbol, action, price, stopLoss);
      results.push(result);
      
      // Add delay between orders to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📈 IIFL Orders Summary: ${successful} successful, ${failed} failed`);
    
    return results;

  } catch (error) {
    console.error("💥 Error in IIFL order processing:", error);
    return [];
  }
}

async function placeOrdersForSubscribedEpicriseUsers(symbol, action, price, stopLoss) {
  try {
    console.log(`🔄 Processing Epicrise orders for ${symbol} - ${action} at ₹${price}`);

    // Use subscription manager to get all subscribed users (consistent with BankNifty and OptionTrade)
    const { getSubscribedUsers } = require("../../../../utils/subscriptionManager");
    const users = await getSubscribedUsers('Epicrise', symbol);

    if (!users || users.length === 0) {
      console.log("⚠️ No users subscribed to Epicrise strategy");
      return [];
    }

    console.log(`📊 Found ${users.length} subscribed Epicrise users`);

    const results = [];

    // Process each user
    for (const user of users) {
      // User object already has subscription data merged by subscriptionManager
      // subscription.capital contains the allocated capital for this strategy
      const userWithCapital = {
        ...user,
        capital: user.subscription?.capital || 0
      };

      const result = await placeOrderForUser(userWithCapital, symbol, action, price, stopLoss);
      results.push(result);

      // Add delay between orders to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`📈 Epicrise Orders Summary: ${successful} successful, ${failed} failed`);

    return results;

  } catch (error) {
    console.error("💥 Error in Epicrise order processing:", error);
    return [];
  }
}

// Round function for tick size compliance (same as Motilal Oswal and Dhan)
function roundToTwoDecimalsEndingInZero(value) {
  let tickSize;

  if (value <= 250) {
    tickSize = 0.01;
  } else if (value <= 1000) {
    tickSize = 0.05;
  } else if (value <= 5000) {
    tickSize = 0.1;
  } else if (value <= 10000) {
    tickSize = 0.5;
  } else if (value <= 20000) {
    tickSize = 1.0;
  } else {
    tickSize = 5.0;
  }

  // Round the value to the nearest tick size
  const rounded = (Math.round(value / tickSize) * tickSize).toFixed(2);
  return parseFloat(rounded);
}

/**
 * Send Telegram notification for Epicrise orders
 */
async function sendTelegramNotification(symbol, action, price, stopLoss, results) {
  try {
    const { sendMessageToTelegram } = require("../Utils/utilities");
    const CONFIG = require("../Utils/config");

    const botToken = CONFIG.EPICRISE.TELEGRAM_BOT_TOKEN;
    const channelId = CONFIG.EPICRISE.CHANNEL_ID;

    if (!botToken || !channelId) {
      console.log("⚠️ Telegram credentials not configured, skipping notification");
      return { success: false, error: "Telegram not configured" };
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const mainEmoji = action.toLowerCase() === "buy" ? "📈" : "📉";
    const actionEmoji = action.toLowerCase() === "buy" ? "🟢" : "🔴";
    const riskPerShare = Math.abs(stopLoss - price).toFixed(2);
    const riskPercentage = ((Math.abs(stopLoss - price) / price) * 100).toFixed(2);

    let message = `${mainEmoji} EPICRISE TRADING SIGNAL ${mainEmoji}

${actionEmoji} Action: ${action.toUpperCase()}
📌 Symbol: ${symbol}
💰 Entry Price: ₹${price.toFixed(2)}
🛑 Stop Loss: ₹${stopLoss.toFixed(2)}

📊 Risk Management:
├─ Risk per share: ₹${riskPerShare}
└─ Risk percentage: ${riskPercentage}%

📈 Execution Summary:
├─ ✅ Successful: ${successful}
├─ ❌ Failed: ${failed}
└─ 📊 Total: ${results.length}

⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

⚠️ Note: Always use proper risk management and position sizing.`;

    console.log("\n📤 Sending Telegram notification...");
    const result = await sendMessageToTelegram(botToken, channelId, message, 0, false);

    if (result.ok) {
      console.log(`✅ Telegram notification sent successfully (Message ID: ${result.messageId})`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`❌ Failed to send Telegram notification:`, result.error);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error("❌ Error sending Telegram notification:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  placeOrderForUser,
  placeOrdersForAllUsers,
  placeOrdersForSubscribedEpicriseUsers,
  getInstrumentID,
  roundToTwoDecimalsEndingInZero,
  sendTelegramNotification
};
