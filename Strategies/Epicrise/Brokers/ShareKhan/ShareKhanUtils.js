const axios = require("axios");
const OrderResponse = require("../../../../models/OrderResponse");

const { BUY_ADJUSTMENT, SELL_ADJUSTMENT } = require("../../Utils/utilities");

// Helper functions for ShareKhan order placement
async function shareKhanHandleClientOrder(
  client,
  document,
  price,
  transactionType,
  credentials,
  stopLossPrice
) {
  const { clientName, accessToken, apiKey, capital } = client;

  console.log("🟢".repeat(40));
  console.log(`🚀 STARTING ORDER PROCESSING FOR SHAREKHAN CLIENT: ${clientName}`);
  console.log("🟢".repeat(40));
  console.log("📊 Client Details:");
  console.log(`   👤 Name: ${clientName}`);
  console.log(`   💰 Capital: ₹${capital}`);
  console.log(`   🔑 Has Access Token: ${!!accessToken}`);
  console.log(`   🔑 Access Token Length: ${accessToken ? accessToken.length : 0} chars`);
  console.log(`   🔑 Has API Key: ${!!apiKey}`);

  if (!accessToken || !apiKey || !capital) {
    console.error(`ShareKhan client ${clientName} missing required fields:`, {
      hasAccessToken: !!accessToken,
      hasApiKey: !!apiKey,
      hasCapital: !!capital
    });
    return { success: false, error: "Missing required client credentials" };
  }

  // Additional validation for token validity and login status
  if (user.tokenValidity && new Date() > new Date(user.tokenValidity)) {
    console.error(`⚠️ ShareKhan user ${clientName} has expired token`);
    return { success: false, error: `Token expired for ${clientName}. Please wait for next login cycle.` };
  }

  if (user.loginStatus !== 'success') {
    console.error(`⚠️ ShareKhan user ${clientName} login status: ${user.loginStatus}`);
    return { success: false, error: `Login not successful for ${clientName}. Status: ${user.loginStatus}` };
  }

  // Calculate quantity based on capital and price
  const adjustedPrice = transactionType.toUpperCase() === "BUY" 
    ? price + BUY_ADJUSTMENT 
    : price - SELL_ADJUSTMENT;
  
  const quantity = Math.floor(capital / adjustedPrice);

  console.log("📈 Order Calculation:");
  console.log(`   💵 Original Price: ₹${price}`);
  console.log(`   💵 Adjusted Price: ₹${adjustedPrice}`);
  console.log(`   📊 Calculated Quantity: ${quantity}`);
  console.log(`   💰 Total Value: ₹${(adjustedPrice * quantity).toFixed(2)}`);

  if (quantity <= 0) {
    console.error(`Insufficient capital for ShareKhan client ${clientName}`);
    return { success: false, error: "Insufficient capital for trade" };
  }

  // Create primary order data
  const orderData = shareKhanCreateOrderData(
    document,
    transactionType,
    adjustedPrice,
    quantity
  );

  console.log("📤 Primary Order Data:");
  console.log(JSON.stringify(orderData, null, 2));

  try {
    const response = await shareKhanPlaceOrder(orderData, accessToken, apiKey);

    // Save primary order response to database
    try {
      const primaryOrderRecord = new OrderResponse({
        clientName: clientName,
        broker: "SHAREKHAN",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: response && response.status ? "SUCCESS" : "FAILED",
        response: response,
      });
      await primaryOrderRecord.save();
    } catch (dbError) {
      console.error("Error saving primary order to database:", dbError);
    }

    // Place stop loss order after 5 seconds
    setTimeout(async () => {
      const stopLossOrderData = shareKhanCreateStopLossOrderData(
        document,
        transactionType,
        stopLossPrice,
        quantity
      );

      console.log("📤 Stop Loss Order Data:");
      console.log(JSON.stringify(stopLossOrderData, null, 2));

      try {
        const stopLossResponse = await shareKhanPlaceOrder(
          stopLossOrderData,
          accessToken,
          apiKey
        );

        // Save stop loss order response to database
        try {
          const stopLossOrderRecord = new OrderResponse({
            clientName: clientName,
            broker: "SHAREKHAN",
            symbol: document.symbol,
            transactionType: transactionType.toUpperCase() === "BUY" ? "SELL" : "BUY",
            orderType: "STOP_LOSS",
            price: stopLossPrice,
            quantity: quantity,
            status: stopLossResponse && stopLossResponse.status ? "SUCCESS" : "FAILED",
            response: stopLossResponse,
          });
          await stopLossOrderRecord.save();
        } catch (dbError) {
          console.error("Error saving stop loss order to database:", dbError);
        }

        console.log("✅ Stop loss order placed successfully for ShareKhan client:", clientName);
      } catch (stopLossError) {
        console.error("❌ Error placing stop loss order for ShareKhan client:", clientName, stopLossError.message);
      }
    }, 5000);

    console.log("✅ Primary order placed successfully for ShareKhan client:", clientName);
    return { success: true, response: response };

  } catch (error) {
    console.error("❌ Error placing primary order for ShareKhan client:", clientName, error.message);
    
    // Save failed order to database
    try {
      const failedOrderRecord = new OrderResponse({
        clientName: clientName,
        broker: "SHAREKHAN",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: "FAILED",
        response: { error: error.message },
      });
      await failedOrderRecord.save();
    } catch (dbError) {
      console.error("Error saving failed order to database:", dbError);
    }

    return { success: false, error: error.message };
  }
}

// Function to create order data for ShareKhan API
function shareKhanCreateOrderData(document, transactionType, price, quantity) {
  const orderData = {
    exchange: "NSE",
    tradingSymbol: document.symbol,
    transactionType: transactionType.toUpperCase(),
    orderType: "LIMIT",
    product: "INTRADAY",
    quantity: parseInt(quantity),
    price: parseFloat(roundToTwoDecimalsEndingInZero(price)),
    validity: "DAY",
    disclosedQuantity: 0,
    triggerPrice: 0,
    tag: `EPICRISE_${Date.now()}`
  };

  return orderData;
}

// Function to create stop loss order data
function shareKhanCreateStopLossOrderData(document, transactionType, stopLossPrice, quantity) {
  // Reverse transaction type for stop loss
  const stopLossTransactionType = transactionType.toUpperCase() === "BUY" ? "SELL" : "BUY";
  
  const orderData = {
    exchange: "NSE",
    tradingSymbol: document.symbol,
    transactionType: stopLossTransactionType,
    orderType: "STOP_LOSS_LIMIT",
    product: "INTRADAY",
    quantity: parseInt(quantity),
    price: parseFloat(roundToTwoDecimalsEndingInZero(stopLossPrice)),
    triggerPrice: parseFloat(roundToTwoDecimalsEndingInZero(stopLossPrice)),
    validity: "DAY",
    disclosedQuantity: 0,
    tag: `EPICRISE_SL_${Date.now()}`
  };

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

// Function to place order via ShareKhan API
async function shareKhanPlaceOrder(orderData, accessToken, apiKey) {
  console.log("🌐 CALLING SHAREKHAN API");
  console.log("📡 API Endpoint: https://api.sharekhan.com/skapi/orders/regular");
  console.log("🔑 Access Token Length:", accessToken ? accessToken.length : 0);
  console.log("🔑 Access Token First 10 chars:", accessToken ? accessToken.substring(0, 10) + "..." : "N/A");
  console.log("🔑 Access Token Last 10 chars:", accessToken ? "..." + accessToken.substring(accessToken.length - 10) : "N/A");
  console.log("📤 Request Headers:");
  console.log("   Content-Type: application/json");
  console.log("   access-token: [HIDDEN]");
  console.log("   api-key: [HIDDEN]");
  console.log("📤 Request Body:");
  console.log(JSON.stringify(orderData, null, 2));

  // Validate access token
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new Error("Invalid access token: Token is empty or not a string");
  }

  // Validate API key
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error("Invalid API key: Key is empty or not a string");
  }

  // Validate order data types
  if (typeof orderData.quantity !== 'number' || !Number.isInteger(orderData.quantity)) {
    throw new Error(`Invalid quantity: Expected integer, got ${typeof orderData.quantity} (${orderData.quantity})`);
  }
  
  if (orderData.price !== undefined && typeof orderData.price !== 'number') {
    throw new Error(`Invalid price: Expected number, got ${typeof orderData.price} (${orderData.price})`);
  }

  try {
    console.log("⏳ Sending HTTP POST request to ShareKhan API...");
    const startTime = Date.now();

    const response = await axios.post(
      "https://api.sharekhan.com/skapi/orders/regular",
      orderData,
      {
        headers: {
          "Content-Type": "application/json",
          "access-token": accessToken,
          "api-key": apiKey,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const endTime = Date.now();
    console.log(`✅ ShareKhan API Response received in ${endTime - startTime}ms`);
    console.log("📥 Response Status:", response.status);
    console.log("📥 Response Headers:");
    console.log(JSON.stringify(response.headers, null, 2));
    console.log("📥 Response Data:");
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error("❌ ShareKhan API Error:");
    console.error(`   🔴 Error Type: ${error.constructor.name}`);
    console.error(`   📝 Error Message: ${error.message}`);
    
    if (error.response) {
      console.error(`   📊 HTTP Status: ${error.response.status}`);
      console.error(`   📊 Status Text: ${error.response.statusText}`);
      console.error("   📥 Error Response Headers:");
      console.error(JSON.stringify(error.response.headers, null, 2));
      console.error("   📥 Error Response Data:");
      console.error(JSON.stringify(error.response.data, null, 2));
      
      // Check for specific ShareKhan API error messages
      if (error.response.data) {
        console.error("   🔍 SHAREKHAN API ERROR DETAILS:");
        if (error.response.data.errorType) {
          console.error(`      Error Type: ${error.response.data.errorType}`);
        }
        if (error.response.data.errorCode) {
          console.error(`      Error Code: ${error.response.data.errorCode}`);
        }
        if (error.response.data.errorMessage) {
          console.error(`      Error Message: ${error.response.data.errorMessage}`);
        }
        if (error.response.data.message) {
          console.error(`      Message: ${error.response.data.message}`);
        }
      }
    } else if (error.request) {
      console.error("   🌐 No response received from server");
      console.error("   📤 Request details:", error.request);
    } else {
      console.error("   🔧 Request setup error:", error.message);
    }

    throw error;
  }
}

module.exports = {
  shareKhanHandleClientOrder,
  shareKhanCreateOrderData,
  shareKhanCreateStopLossOrderData,
  shareKhanPlaceOrder,
  roundToTwoDecimalsEndingInZero
};
