const axios = require("axios");
const OrderResponse = require("../../../../models/OrderResponse");
const IIFLUser = require("../../../../models/IIFLUser");
const { findSymbolInDatabase } = require("../../../../newdb");

const IIFL_BASE_URL = "https://api.iiflcapital.com/v1";

/**
 * Place order for a single IIFL user (CMI Strategy)
 * @param {Object} user - IIFL user object
 * @param {string} symbol - Trading symbol
 * @param {string} action - BUY or SELL
 * @param {number} price - Order price
 * @param {number} stopLoss - Stop loss price
 * @returns {Object} - Order response
 */
async function placeOrderForUser(user, symbol, action, price, stopLoss) {
  const { clientName, token, capital, userID } = user;

  console.log(`📊 CMI IIFL Client Details:`);
  console.log(`   👤 Name: ${clientName}`);
  console.log(`   💰 Capital: ₹${capital.toLocaleString()}`);
  console.log(`   🔑 Has Token: ${!!token}`);
  console.log(`   🔑 Token Length: ${token ? token.length : 0} chars`);
  console.log(`   👤 User ID: ${userID}`);

  if (!token) {
    console.log(`❌ CMI IIFL: No token available for ${clientName}`);
    return { success: false, error: `No token available for ${clientName}` };
  }

  if (!capital || capital <= 0) {
    console.log(`❌ CMI IIFL: Invalid capital for ${clientName}: ₹${capital}`);
    return { success: false, error: `Invalid capital for ${clientName}` };
  }

  try {
    // Calculate quantity based on capital and price
    const quantity = Math.floor(capital / price);
    
    if (quantity <= 0) {
      console.log(`⚠️ CMI IIFL: Insufficient capital for ${clientName}. Required: ₹${price}, Available: ₹${capital}`);
      return { success: false, error: `Insufficient capital for ${clientName}` };
    }

    console.log(`📈 CMI IIFL: Placing ${action} order for ${quantity} shares of ${symbol} at ₹${price}`);

    // Get instrument ID from database
    let instrumentId;
    try {
      instrumentId = await getInstrumentID(symbol);
    } catch (error) {
      console.error(`❌ CMI IIFL: Failed to get instrument ID for ${symbol}:`, error.message);
      return {
        success: false,
        error: `Failed to get instrument ID for ${symbol}: ${error.message}`,
        clientName: clientName
      };
    }

    // CMI IIFL Order payload
    const orderPayload = [{
      instrumentId: instrumentId,
      exchange: "NSEEQ",
      transactionType: action.toUpperCase(),
      quantity: quantity.toString(),
      orderComplexity: "REGULAR",
      product: "INTRADAY",
      orderType: "LIMIT",
      validity: "DAY",
      price: parseFloat(price).toString(),
      apiOrderSource: "CMITrading", // CMI-specific source
      orderTag: `CMI_${symbol}_${Date.now()}` // CMI-specific tag
    }];

    console.log(`📡 CMI IIFL Raw Request Payload for ${clientName}:`);
    console.log(JSON.stringify(orderPayload, null, 2));

    // Place order via IIFL API
    console.log(`🚀 CMI IIFL: Sending order request for ${clientName}...`);
    const response = await axios.post(
      `${IIFL_BASE_URL}/orders`,
      orderPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        timeout: 15000 // Increase timeout to 15 seconds
      }
    );

    console.log(`✅ CMI IIFL Raw Order Response for ${clientName}:`);
    console.log(`📊 Status Code: ${response.status}`);
    console.log(`📊 Raw Response Data:`, response.data);

    // Place stop loss order
    if (stopLoss && stopLoss > 0) {
      console.log(`🛡️ CMI IIFL - Preparing stop loss order at ₹${stopLoss}`);
      
      const triggerPrice = roundToTwoDecimalsEndingInZero(stopLoss);
      const limitPrice = action.toUpperCase() === "BUY" 
        ? roundToTwoDecimalsEndingInZero(stopLoss * 0.9976) // For BUY orders, SL is SELL at lower price
        : roundToTwoDecimalsEndingInZero(stopLoss * 1.0024); // For SELL orders, SL is BUY at higher price

      const stopLossAction = action.toUpperCase() === "BUY" ? "SELL" : "BUY";

      console.log(`🔧 CMI IIFL Stop-loss price calculation:`);
      console.log(`   Original Stop Loss: ₹${stopLoss}`);
      console.log(`   Trigger Price (rounded): ₹${triggerPrice}`);
      console.log(`   Limit Price (${stopLossAction}): ₹${limitPrice}`);
      console.log(`   Transaction Type: ${action} → ${stopLossAction}`);

      const stopLossPayload = [{
        instrumentId: instrumentId,
        exchange: "NSEEQ",
        transactionType: stopLossAction,
        quantity: quantity.toString(),
        orderComplexity: "REGULAR",
        product: "INTRADAY",
        orderType: "SL",
        validity: "DAY",
        price: limitPrice.toString(),
        slTriggerPrice: triggerPrice.toString(),
        apiOrderSource: "CMITrading", // CMI-specific source
        orderTag: `CMI_SL_${symbol}_${Date.now()}` // CMI-specific tag
      }];

      console.log("📋 CMI IIFL Stop-loss order payload:");
      console.log(JSON.stringify(stopLossPayload, null, 2));

      try {
        const stopLossResponse = await axios.post(
          `${IIFL_BASE_URL}/orders`,
          stopLossPayload,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            timeout: 15000
          }
        );

        console.log(`✅ CMI IIFL stop loss order placed for ${clientName}:`, stopLossResponse.data);
      } catch (stopLossError) {
        console.error(`❌ CMI IIFL stop loss order failed for ${clientName}:`, stopLossError.message);
      }
    }

    // Save to database
    const orderResponse = new OrderResponse({
      clientName: clientName,
      symbol: symbol,
      action: action,
      quantity: quantity,
      price: price,
      response: response.data,
      timestamp: new Date(),
      broker: "IIFL",
      strategy: "CMI"
    });

    await orderResponse.save();
    console.log(`💾 CMI IIFL order response saved to database for ${clientName}`);

    return {
      success: true,
      clientName: clientName,
      symbol: symbol,
      action: action,
      quantity: quantity,
      price: price,
      response: response.data
    };

  } catch (error) {
    console.error(`💥 CMI IIFL Error for ${clientName}:`, error.message);
    
    if (error.code === 'ECONNABORTED') {
      console.error(`⏰ CMI IIFL: Request timeout for ${clientName}`);
      return { success: false, error: `Request timeout for ${clientName}`, clientName: clientName };
    }
    
    return { success: false, error: error.message, clientName: clientName };
  }
}

/**
 * Get instrument ID from database
 */
async function getInstrumentID(symbol) {
  console.log(`🔍 CMI IIFL: Looking up instrument ID for symbol: ${symbol}`);
  
  const symbolData = await findSymbolInDatabase(symbol);
  if (!symbolData) {
    throw new Error(`Symbol ${symbol} not found in database`);
  }
  
  console.log(`✅ CMI IIFL Symbol Mapping (Database): ${symbol} -> ${symbolData.token} (from ${symbolData.symbol})`);
  return parseInt(symbolData.token);
}

/**
 * Place orders for all IIFL users (CMI Strategy)
 */
async function placeOrdersForAllUsers(symbol, action, price, stopLoss) {
  try {
    console.log(`🔄 CMI IIFL: Processing orders for ${symbol} - ${action} at ₹${price}`);
    
    const users = await IIFLUser.find({ state: "live" });
    
    if (!users || users.length === 0) {
      console.log("⚠️ CMI IIFL: No users found");
      return [];
    }

    console.log(`📊 CMI IIFL: Found ${users.length} users`);

    const results = [];
    
    for (const user of users) {
      const result = await placeOrderForUser(user, symbol, action, price, stopLoss);
      results.push(result);
      
      // Add delay between orders
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📈 CMI IIFL Orders Summary: ${successful} successful, ${failed} failed`);
    
    return results;

  } catch (error) {
    console.error("💥 CMI IIFL Error in order processing:", error);
    return [];
  }
}

// Round function for tick size compliance
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

  const rounded = (Math.round(value / tickSize) * tickSize).toFixed(2);
  return parseFloat(rounded);
}

module.exports = {
  placeOrderForUser,
  placeOrdersForAllUsers,
  getInstrumentID,
  roundToTwoDecimalsEndingInZero
};
