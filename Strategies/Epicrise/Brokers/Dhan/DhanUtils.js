const axios = require("axios");
const OrderResponse = require("../../../../models/OrderResponse");
const { BUY_ADJUSTMENT, SELL_ADJUSTMENT } = require("../../Utils/utilities");

// Helper functions for Dhan order placement
async function dhanHandleClientOrder(
  client,
  document,
  price,
  transactionType,
  credentials,
  stopLossPrice
) {
  const { clientName, jwtToken, dhanClientId, capital } = client;

  console.log("🔵".repeat(40));
  console.log(`🚀 STARTING ORDER PROCESSING FOR DHAN CLIENT: ${clientName}`);
  console.log("🔵".repeat(40));
  console.log("📊 Client Details:");
  console.log(`   👤 Name: ${clientName}`);
  console.log(`   🆔 Dhan Client ID: ${dhanClientId}`);
  console.log(`   💰 Capital: ₹${capital}`);

  if (!jwtToken || !dhanClientId || !capital) {
    console.error(`❌ VALIDATION ERROR: Dhan client ${clientName} missing required fields:`);
    console.error("📋 Missing fields:", {
      hasJwtToken: !!jwtToken,
      hasDhanClientId: !!dhanClientId,
      hasCapital: !!capital
    });
    console.log("🔵".repeat(40));
    return { success: false, error: "Missing required client credentials" };
  }

  if (!document || !document.symbol || !document.token) {
    console.error(`❌ DOCUMENT ERROR: Invalid document for Dhan client ${clientName}:`);
    console.error("📄 Document:", document);
    console.log("🔵".repeat(40));
    return { success: false, error: "Invalid symbol document" };
  }

  console.log("📄 Trading Document:");
  console.log(`   🎯 Symbol: ${document.symbol}`);
  console.log(`   🔢 Token: ${document.token}`);
  console.log(`   📝 Name: ${document.name || 'N/A'}`);

  const adjustedPrice = adjustPriceForTransaction(price, transactionType);
  console.log("💰 Price Calculation:");
  console.log(`   📈 Original Price: ₹${price}`);
  console.log(`   🔧 Adjusted Price: ₹${adjustedPrice}`);
  console.log(`   📊 Transaction Type: ${transactionType}`);

  // Check if stopLossPrice is undefined or null
  if (stopLossPrice === undefined || stopLossPrice === null) {
    console.log("🛡️ Calculating default stop loss (2.5% from message price)...");
    if (transactionType.toUpperCase() === "SELL") {
      // For SELL orders, stop loss is 2.5% above the message price
      stopLossPrice = price * 1.025;
      console.log(`   📈 SELL order: Stop loss 2.5% above = ₹${stopLossPrice}`);
    } else {
      // For BUY orders, stop loss is 2.5% below the message price
      stopLossPrice = price * 0.975;
      console.log(`   📉 BUY order: Stop loss 2.5% below = ₹${stopLossPrice}`);
    }
  } else {
    console.log(`🛡️ Using provided stop loss: ₹${stopLossPrice}`);
  }

  const quantity = Math.floor(capital / adjustedPrice);
  console.log("📊 Quantity Calculation:");
  console.log(`   💰 Capital: ₹${capital}`);
  console.log(`   💵 Price per share: ₹${adjustedPrice}`);
  console.log(`   📦 Calculated Quantity: ${quantity} shares`);

  if (quantity <= 0) {
    console.error(`❌ QUANTITY ERROR: Invalid quantity calculated for ${clientName}: ${quantity}`);
    console.error("💡 Possible reasons: Capital too low or price too high");
    console.log("🔵".repeat(40));
    return { success: false, error: "Insufficient capital for order" };
  }

  console.log("📋 Creating order data...");
  const orderData = dhanCreateOrderData(
    document,
    transactionType,
    adjustedPrice,
    quantity,
    dhanClientId
  );

  // Store primary correlation ID for linking with stop loss order
  const primaryCorrelationId = orderData.correlationId;

  console.log("📤 Order Data Created:");
  console.log(JSON.stringify(orderData, null, 2));

  try {
    console.log(`🚀 PLACING PRIMARY ORDER for ${clientName}...`);
    console.log("⏳ Sending request to Dhan API...");

    const response = await dhanPlaceOrder(orderData, jwtToken);

    console.log(`✅ PRIMARY ORDER RESPONSE for ${clientName}:`);
    console.log(JSON.stringify(response, null, 2));

    // Save primary order response to database
    console.log("💾 Saving primary order to database...");
    try {
      const primaryOrderRecord = new OrderResponse({
        clientName: clientName,
        broker: "DHAN",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: response && response.orderId ? "SUCCESS" : "FAILED",
        response: response,
      });
      await primaryOrderRecord.save();
      console.log(`✅ Primary order saved to database for ${clientName}`);
      console.log(`   📋 Order ID: ${response?.orderId || 'N/A'}`);
      console.log(`   📊 Status: ${response?.orderStatus || 'N/A'}`);

      // Broadcast order update via WebSocket
      if (global.wsManager) {
        console.log("📡 Broadcasting order update via WebSocket...");
        global.wsManager.broadcastNewOrder({
          clientName,
          broker: "DHAN",
          symbol: document.symbol,
          transactionType: transactionType.toUpperCase(),
          price: adjustedPrice,
          quantity: quantity,
          status: response && response.orderId ? "SUCCESS" : "FAILED"
        });
        console.log("✅ WebSocket broadcast completed");
      } else {
        console.log("⚠️ WebSocket manager not available");
      }
    } catch (dbError) {
      console.error(`❌ DATABASE ERROR: Failed to save primary order for ${clientName}:`);
      console.error(dbError.message);
    }

    // Place stop loss order after a delay
    console.log("⏰ Scheduling stop loss order placement in 2 seconds...");
    setTimeout(async () => {
      console.log(`🛡️ PLACING STOP LOSS ORDER for ${clientName}...`);

      const stopLossOrderData = dhanCreateStopLossOrderData(
        document,
        transactionType,
        stopLossPrice,
        quantity,
        dhanClientId,
        primaryCorrelationId
      );

      console.log("📤 Stop Loss Order Data:");
      console.log(JSON.stringify(stopLossOrderData, null, 2));

      try {
        console.log("⏳ Sending stop loss request to Dhan API...");
        const stopLossResponse = await dhanPlaceOrder(stopLossOrderData, jwtToken);

        console.log(`✅ STOP LOSS ORDER RESPONSE for ${clientName}:`);
        console.log(JSON.stringify(stopLossResponse, null, 2));

        // Save stop loss order response to database
        console.log("💾 Saving stop loss order to database...");
        try {
          const stopLossOrderRecord = new OrderResponse({
            clientName: clientName,
            broker: "DHAN",
            symbol: document.symbol,
            transactionType: transactionType.toUpperCase() === "BUY" ? "SELL" : "BUY",
            orderType: "STOP_LOSS",
            price: stopLossPrice,
            quantity: quantity,
            status: stopLossResponse && stopLossResponse.orderId ? "SUCCESS" : "FAILED",
            response: stopLossResponse,
          });
          await stopLossOrderRecord.save();
          console.log(`✅ Stop loss order saved to database for ${clientName}`);
          console.log(`   📋 SL Order ID: ${stopLossResponse?.orderId || 'N/A'}`);
          console.log(`   📊 SL Status: ${stopLossResponse?.orderStatus || 'N/A'}`);
        } catch (dbError) {
          console.error(`❌ DATABASE ERROR: Failed to save stop loss order for ${clientName}:`);
          console.error(dbError.message);
        }
      } catch (stopLossError) {
        console.error(`❌ STOP LOSS ERROR for ${clientName}:`);
        console.error(`   🔍 Error: ${stopLossError.message}`);
        console.error(`   📊 Full Error:`, stopLossError);
      }

      console.log("🔵".repeat(40));
    }, 2000); // 2 second delay

    console.log(`✅ ORDER PROCESSING COMPLETED for ${clientName}`);
    console.log("🔵".repeat(40));
    return { success: true, response };
  } catch (error) {
    console.error(`❌ PRIMARY ORDER FAILED for ${clientName}:`);
    console.error(`   🔍 Error Type: ${error.constructor.name}`);
    console.error(`   🔍 Error Message: ${error.message}`);
    console.error(`   📊 Full Error:`, error);
    console.log("🔵".repeat(40));
    return { success: false, error: error.message };
  }
}

// Function to adjust price based on transaction type
function adjustPriceForTransaction(price, transactionType) {
  if (transactionType.toUpperCase() === "BUY") {
    return price + BUY_ADJUSTMENT;
  } else if (transactionType.toUpperCase() === "SELL") {
    return price - SELL_ADJUSTMENT;
  }
  return price;
}

// Global counter to ensure unique correlation IDs
let correlationCounter = 0;

// Function to generate unique correlation ID
function generateUniqueCorrelationId(prefix = '') {
  correlationCounter++;
  const timestamp = Date.now().toString().slice(-6);
  const counter = correlationCounter.toString().padStart(3, '0');
  const random = Math.random().toString(36).substring(2, 4);
  return `${prefix}${timestamp}${counter}${random}`;
}

// Function to create order data for Dhan API
function dhanCreateOrderData(document, transactionType, price, quantity, dhanClientId, baseCorrelationId = null) {
  // Generate unique correlation ID for primary order
  const correlationId = baseCorrelationId || generateUniqueCorrelationId('P');

  const orderData = {
    dhanClientId: String(dhanClientId), // Ensure it's a string
    correlationId: correlationId,
    transactionType: transactionType.toUpperCase(),
    exchangeSegment: "NSE_EQ",
    productType: "INTRADAY",
    orderType: "LIMIT",
    validity: "DAY",
    securityId: String(document.token), // Keep as string per API documentation
    quantity: parseInt(quantity), // Convert to number (integer)

    price: parseFloat(roundToTwoDecimalsEndingInZero(price)), // Convert to float
   
   
  
  };

  console.log(`📋 Primary Order Correlation ID: ${orderData.correlationId}`);
  console.log(`🔢 Security ID: ${document.token} (string)`);
  return orderData;
}

// Function to create stop loss order data
function dhanCreateStopLossOrderData(document, transactionType, stopLossPrice, quantity, dhanClientId, primaryCorrelationId) {
  // Reverse transaction type for stop loss
  const stopLossTransactionType = transactionType.toUpperCase() === "BUY" ? "SELL" : "BUY";

  // For stop loss orders, we need both triggerPrice and price
  // triggerPrice is when the order gets triggered
  // price is the limit price for the stop loss order (can be same as trigger or slightly worse)
  const triggerPriceValue = parseFloat(roundToTwoDecimalsEndingInZero(stopLossPrice));

  // Set limit price slightly worse than trigger price to ensure execution
  // For SELL stop loss (when original was BUY), set price slightly below trigger
  // For BUY stop loss (when original was SELL), set price slightly above trigger
  let limitPrice;
  if (stopLossTransactionType === "SELL") {
    // For SELL stop loss, set limit price 0.5% below trigger price
    limitPrice = triggerPriceValue * 0.995;
  } else {
    // For BUY stop loss, set limit price 0.5% above trigger price
    limitPrice = triggerPriceValue * 1.005;
  }

  // Generate unique correlation ID for stop loss order, linked to primary order
  const correlationId = generateUniqueCorrelationId('S');

  const orderData = {
    dhanClientId: String(dhanClientId), // Ensure it's a string
    correlationId: correlationId,
    transactionType: stopLossTransactionType,
    exchangeSegment: "NSE_EQ",
    productType: "INTRADAY",
    orderType: "STOP_LOSS",
    validity: "DAY",
    securityId: String(document.token), // Keep as string per API documentation
    quantity: parseInt(quantity), // Convert to number (integer)
    disclosedQuantity: "", // Empty string for optional field
    price: parseFloat(roundToTwoDecimalsEndingInZero(limitPrice)), // Required for STOP_LOSS orders
    triggerPrice: triggerPriceValue, // Price at which order gets triggered
    afterMarketOrder: false,
    
    
  };

  console.log(`🛡️ Stop Loss Order Details:`);
  console.log(`   📋 Stop Loss Correlation ID: ${orderData.correlationId}`);
  console.log(`   🔗 Linked to Primary Order: ${primaryCorrelationId}`);
  console.log(`   📊 Transaction Type: ${stopLossTransactionType}`);
  console.log(`   🎯 Trigger Price: ₹${triggerPriceValue}`);
  console.log(`   💰 Limit Price: ₹${orderData.price}`);
  console.log(`   📦 Quantity: ${quantity}`);

  return orderData;
}

// Round function for prices
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

// Function to place order via Dhan API
async function dhanPlaceOrder(orderData, jwtToken) {
  console.log("🌐 CALLING DHAN API");
  console.log("📡 API Endpoint: https://api.dhan.co/v2/orders");
  console.log("📤 Request Body:");
  console.log(JSON.stringify(orderData, null, 2));

  // Validate JWT token
  if (!jwtToken || typeof jwtToken !== 'string' || jwtToken.trim().length === 0) {
    throw new Error("Invalid JWT token: Token is empty or not a string");
  }

  // Validate order data types according to Dhan API requirements
  if (typeof orderData.quantity !== 'number' || !Number.isInteger(orderData.quantity) || orderData.quantity <= 0) {
    throw new Error(`Invalid quantity: Expected positive integer, got ${typeof orderData.quantity} (${orderData.quantity})`);
  }

  if (orderData.price !== undefined && typeof orderData.price !== 'number') {
    throw new Error(`Invalid price: Expected number, got ${typeof orderData.price} (${orderData.price})`);
  }

  if (orderData.triggerPrice !== undefined && typeof orderData.triggerPrice !== 'number') {
    throw new Error(`Invalid triggerPrice: Expected number, got ${typeof orderData.triggerPrice} (${orderData.triggerPrice})`);
  }

  // Validate required string fields
  if (!orderData.dhanClientId || typeof orderData.dhanClientId !== 'string') {
    throw new Error(`Invalid dhanClientId: Expected non-empty string, got ${typeof orderData.dhanClientId} (${orderData.dhanClientId})`);
  }

  if (!orderData.securityId || typeof orderData.securityId !== 'string') {
    throw new Error(`Invalid securityId: Expected non-empty string, got ${typeof orderData.securityId} (${orderData.securityId})`);
  }

  try {
    console.log("⏳ Sending HTTP POST request to Dhan API...");
    const startTime = Date.now();

    const response = await axios.post(
      "https://api.dhan.co/v2/orders",
      orderData,
      {
        headers: {
          "Content-Type": "application/json",
          "access-token": jwtToken,
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log("✅ DHAN API RESPONSE RECEIVED");
    console.log(`⏱️ Response Time: ${responseTime}ms`);
    console.log(`📊 HTTP Status Code: ${response.status}`);
    console.log(`📊 HTTP Status Text: ${response.statusText}`);
    console.log(`⏰ Response Timestamp: ${new Date().toISOString()}`);
    console.log("📥 COMPLETE RESPONSE HEADERS:");
    console.log(JSON.stringify(response.headers, null, 2));
    console.log("📥 COMPLETE RESPONSE DATA:");
    console.log(JSON.stringify(response.data, null, 2));

    // Log specific response fields according to Dhan API documentation
    if (response.data) {
      console.log("🔍 DHAN ORDER PLACEMENT RESPONSE BREAKDOWN:");

      // According to Dhan API docs, order placement response contains only:
      // { "orderId": "112111182198", "orderStatus": "PENDING" }
      if (response.data.orderId) {
        console.log(`   📋 Order ID: ${response.data.orderId}`);
      }
      if (response.data.orderStatus) {
        console.log(`   📊 Order Status: ${response.data.orderStatus}`);
      }

      // Log any additional fields that might be present (for debugging)
      const knownFields = ['orderId', 'orderStatus'];
      const additionalFields = Object.keys(response.data).filter(key => !knownFields.includes(key));

      if (additionalFields.length > 0) {
        console.log("   🔍 Additional fields in response:");
        additionalFields.forEach(field => {
          console.log(`      ${field}: ${response.data[field]}`);
        });
      }
    }

    return response.data;
  } catch (error) {
    console.error("❌ DHAN API ERROR:");
    console.error(`   🔍 Error Type: ${error.constructor.name}`);
    console.error(`   🔍 Error Message: ${error.message}`);
    console.error(`   ⏰ Error Timestamp: ${new Date().toISOString()}`);

    if (error.response) {
      console.error(`   📊 HTTP Status: ${error.response.status}`);
      console.error(`   📊 Status Text: ${error.response.statusText}`);
      console.error("   📥 Error Response Headers:");
      console.error(JSON.stringify(error.response.headers, null, 2));
      console.error("   📥 COMPLETE ERROR RESPONSE DATA:");
      console.error(JSON.stringify(error.response.data, null, 2));

      // Parse Dhan API error response according to documentation
      if (error.response.data) {
        console.error("   🔍 DHAN API ERROR DETAILS:");

        // Standard Dhan API error fields
        if (error.response.data.errorType) {
          console.error(`      ❌ Error Type: ${error.response.data.errorType}`);
        }
        if (error.response.data.errorCode) {
          console.error(`      🔢 Error Code: ${error.response.data.errorCode}`);
        }
        if (error.response.data.errorMessage) {
          console.error(`      💬 Error Message: ${error.response.data.errorMessage}`);
        }
        if (error.response.data.message) {
          console.error(`      📝 Message: ${error.response.data.message}`);
        }

        // Additional error fields that might be present
        const standardErrorFields = ['errorType', 'errorCode', 'errorMessage', 'message'];
        const additionalErrorFields = Object.keys(error.response.data).filter(key => !standardErrorFields.includes(key));

        if (additionalErrorFields.length > 0) {
          console.error("      🔍 Additional error fields:");
          additionalErrorFields.forEach(field => {
            console.error(`         ${field}: ${error.response.data[field]}`);
          });
        }
      }
    } else if (error.request) {
      console.error("   🌐 No response received from server");
      console.error("   📤 COMPLETE REQUEST DETAILS:");
      console.error(JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        timeout: error.config?.timeout,
        data: error.config?.data
      }, null, 2));
    } else {
      console.error("   🔧 Request setup error:", error.message);
      console.error("   🔧 Error stack:", error.stack);
    }

    throw error;
  }
}

module.exports = {
  dhanHandleClientOrder,
  dhanCreateOrderData,
  dhanCreateStopLossOrderData,
};
