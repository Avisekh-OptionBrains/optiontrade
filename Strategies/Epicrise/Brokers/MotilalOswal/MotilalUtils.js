const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const axios = require("axios");
const OrderResponse = require("../../../../models/OrderResponse");

const { BUY_ADJUSTMENT, SELL_ADJUSTMENT } = require("../../Utils/utilities");
// Helper functions for order placement
async function handleClientOrder(
  client,
  document,
  price,
  transactionType,
  credentials,
  stopLossPrice
) {
  const { clientName, authToken, apiKey, capital, userId } = client;

  console.log("🔄 MOTILAL OSWAL - Starting order processing");
  console.log("=".repeat(50));
  console.log(`👤 Client: ${clientName}`);
  console.log(`💰 Capital: ₹${capital}`);
  console.log(`📊 Symbol: ${document?.symbol || 'N/A'}`);
  console.log(`💵 Price: ₹${price}`);
  console.log(`📈 Transaction: ${transactionType.toUpperCase()}`);
  console.log(`🛑 Stop Loss: ${stopLossPrice || 'Auto-calculated'}`);

  if (!authToken || !apiKey || !capital || capital <= 0 || !userId) {
    console.error("❌ MOTILAL OSWAL - Missing required client credentials");
    console.error(`Client: ${clientName}`);
    console.error("Missing fields:", {
      hasAuthToken: !!authToken,
      hasApiKey: !!apiKey,
      hasCapital: !!capital,
      capitalValue: capital,
      hasUserId: !!userId
    });
    // Throw error to be caught as rejected promise for proper failure counting
    throw new Error(`Client ${clientName} validation failed: Missing required fields or invalid capital`);
  }

  if (!document || !document.symbol || !document.token) {
    console.error("❌ MOTILAL OSWAL - Invalid symbol document");
    console.error(`Client: ${clientName}`);
    console.error("Document:", document);
    // Throw error to be caught as rejected promise for proper failure counting
    throw new Error(`Invalid symbol document for client ${clientName}`);
  }

  console.log("✅ MOTILAL OSWAL - Client validation passed");

  // Early capital validation BEFORE price adjustment
  console.log("🔍 MOTILAL OSWAL - Pre-validation capital check:");
  console.log(`   Available Capital: ₹${capital}`);
  console.log(`   Base Price: ₹${price}`);

  // Calculate worst-case adjusted price for validation
  const { BUY_ADJUSTMENT, SELL_ADJUSTMENT } = require("../../Utils/utilities");
  const worstCasePrice = transactionType.toUpperCase() === "BUY" ? price * BUY_ADJUSTMENT : price * SELL_ADJUSTMENT;
  console.log(`   Worst-case Price (after adjustment): ₹${worstCasePrice.toFixed(2)}`);

  if (capital < worstCasePrice) {
    const shortfall = worstCasePrice - capital;
    console.error("❌ MOTILAL OSWAL - INSUFFICIENT CAPITAL DETECTED");
    console.error(`   Client: ${clientName}`);
    console.error(`   Available: ₹${capital}`);
    console.error(`   Required: ₹${worstCasePrice.toFixed(2)}`);
    console.error(`   Shortfall: ₹${shortfall.toFixed(2)}`);
    console.error(`   💡 Solution: Add ₹${Math.ceil(shortfall)} to capital`);

    // Save failed order to database for tracking
    try {
      const failedOrderRecord = new OrderResponse({
        clientName: clientName,
        broker: "MOTILAL",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: worstCasePrice,
        quantity: 0,
        status: "FAILED",
        response: {
          error: "Insufficient capital",
          required: worstCasePrice,
          available: capital,
          shortfall: shortfall,
          reason: "Capital validation failed before order processing"
        },
      });
      await failedOrderRecord.save();
      console.log("💾 MOTILAL OSWAL - Failed order saved to database");
    } catch (dbError) {
      console.error("❌ MOTILAL OSWAL - Error saving failed order to database:", dbError.message);
    }

    // Throw error to be caught as rejected promise for proper failure counting
    throw new Error(`Insufficient capital for ${clientName}. Required: ₹${worstCasePrice.toFixed(2)}, Available: ₹${capital}, Shortfall: ₹${shortfall.toFixed(2)}`);
  }

  console.log("✅ MOTILAL OSWAL - Capital validation passed");

  const adjustedPrice = adjustPriceForTransaction(price, transactionType);
  console.log(`💲 MOTILAL OSWAL - Price adjustment: ${price} → ${adjustedPrice} (${transactionType})`);

  // Check if stopLossPrice is undefined or null
  if (stopLossPrice === undefined || stopLossPrice === null) {
    // Calculate default stop loss price (2.5% from message price)
    if (transactionType.toUpperCase() === "SELL") {
      // For SELL orders, stop loss is 2.5% above the message price
      stopLossPrice = price * 1.025;
    } else {
      // For BUY orders, stop loss is 2.5% below the message price
      stopLossPrice = price * 0.975;
    }
    console.log(`🛑 MOTILAL OSWAL - Auto-calculated stop loss: ₹${stopLossPrice} (2.5% from message price)`);
  } else {
    console.log(`🛑 MOTILAL OSWAL - Using provided stop loss: ₹${stopLossPrice}`);
  }

  const quantity = Math.floor(capital / adjustedPrice);
  console.log(`📊 MOTILAL OSWAL - Quantity calculation:`);
  console.log(`   Capital: ₹${capital}`);
  console.log(`   Adjusted Price: ₹${adjustedPrice}`);
  console.log(`   Calculated Quantity: ${quantity}`);

  // Final quantity validation (should not happen due to early validation)
  if (quantity <= 0) {
    console.error("❌ MOTILAL OSWAL - CRITICAL: Quantity is 0 despite passing capital validation!");
    console.error(`   Client: ${clientName}, Quantity: ${quantity}, Capital: ₹${capital}, Required: ₹${adjustedPrice}`);
    console.error(`   This should not happen - investigate calculation logic`);

    // Throw error to be caught as rejected promise
    throw new Error(`Critical error: Quantity calculation resulted in 0 for ${clientName} despite passing capital validation`);
  }

  console.log("📋 MOTILAL OSWAL - Creating order data...");
  const orderData = createOrderData(
    document,
    transactionType,
    adjustedPrice,
    quantity
  );
  console.log("📋 MOTILAL OSWAL - Order data created:", JSON.stringify(orderData, null, 2));

  try {
    console.log("🚀 MOTILAL OSWAL - Placing primary order...");
    console.log(`   Client: ${clientName}`);
    console.log(`   Order Type: PRIMARY`);
    console.log(`   API Endpoint: https://openapi.motilaloswal.com/rest/trans/v1/placeorder`);

    const response = await placeOrder(
      orderData,
      credentials,
      authToken,
      apiKey,
      userId
    );

    console.log("✅ MOTILAL OSWAL - Primary order response received:");
    console.log(JSON.stringify(response, null, 2));

    // Save primary order response to database
    try {
      console.log("💾 MOTILAL OSWAL - Saving primary order to database...");
      const primaryOrderRecord = new OrderResponse({
        clientName: clientName,
        broker: "MOTILAL",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: response && response.status ? "SUCCESS" : "FAILED",
        response: response,
      });
      await primaryOrderRecord.save();
      console.log("✅ MOTILAL OSWAL - Primary order saved to database successfully");
    } catch (dbError) {
      console.error("❌ MOTILAL OSWAL - Error saving primary order to database:", dbError.message);
    }

    // Only schedule stop-loss if primary order was successful
    if (response && (response.status === 'SUCCESS' || response.success === true)) {
      console.log("⏰ MOTILAL OSWAL - Primary order successful, scheduling stop-loss order in 5 seconds...");
      setTimeout(async () => {
      console.log("🛑 MOTILAL OSWAL - Processing stop-loss order...");
      console.log(`   Client: ${clientName}`);
      console.log(`   Symbol: ${document.symbol}`);

      const stopLossOrderData = createStopLossOrderData(
        document,
        transactionType,
        price,
        stopLossPrice,
        quantity
      );

      console.log("📋 MOTILAL OSWAL - Stop-loss order data created:");
      console.log(JSON.stringify(stopLossOrderData, null, 2));

      try {
        console.log("🚀 MOTILAL OSWAL - Placing stop-loss order...");
        const stopLossResponse = await placeOrder(
          stopLossOrderData,
          credentials,
          authToken,
          apiKey,
          userId
        );

        console.log("✅ MOTILAL OSWAL - Stop-loss order response received:");
        console.log(JSON.stringify(stopLossResponse, null, 2));

        // Save stop-loss order response to database
        try {
          console.log("💾 MOTILAL OSWAL - Saving stop-loss order to database...");
          const stopLossOrderRecord = new OrderResponse({
            clientName: clientName,
            broker: "MOTILAL",
            symbol: document.symbol,
            transactionType: stopLossOrderData.buyorsell,
            orderType: "STOPLOSS",
            price: parseFloat(stopLossOrderData.price),
            quantity: quantity,
            status: stopLossResponse && stopLossResponse.status ? "SUCCESS" : "FAILED",
            response: stopLossResponse,
          });
          await stopLossOrderRecord.save();
          console.log("✅ MOTILAL OSWAL - Stop-loss order saved to database successfully");
        } catch (dbError) {
          console.error("❌ MOTILAL OSWAL - Error saving stop-loss order to database:", dbError.message);
        }
      } catch (error) {
        console.error("❌ MOTILAL OSWAL - Stop-loss order failed:");
        console.error(`   Client: ${clientName}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);

        // Save failed stop-loss order to database
        try {
          console.log("💾 MOTILAL OSWAL - Saving failed stop-loss order to database...");
          const failedStopLossRecord = new OrderResponse({
            clientName: clientName,
            broker: "MOTILAL",
            symbol: document.symbol,
            transactionType: stopLossOrderData.buyorsell,
            orderType: "STOPLOSS",
            price: parseFloat(stopLossOrderData.price),
            quantity: quantity,
            status: "FAILED",
            response: { error: error.message, orderData: stopLossOrderData },
          });
          await failedStopLossRecord.save();
          console.log("✅ MOTILAL OSWAL - Failed stop-loss order saved to database");
        } catch (dbError) {
          console.error("❌ MOTILAL OSWAL - Error saving failed stop-loss order to database:", dbError.message);
        }
      }
      }, 5000);
    } else {
      console.log("⚠️ MOTILAL OSWAL - Primary order failed, skipping stop-loss order");
      console.log(`   Response status: ${response?.status || 'undefined'}`);
      console.log(`   Response success: ${response?.success || 'undefined'}`);
    }
    console.log("✅ MOTILAL OSWAL - Primary order completed successfully");
    console.log(`   Client: ${clientName}`);
    console.log(`   Symbol: ${document.symbol}`);
    console.log(`   Transaction: ${transactionType.toUpperCase()}`);
    console.log("=".repeat(50));

    return { success: true, response: response };

  } catch (error) {
    console.error("❌ MOTILAL OSWAL - Primary order failed:");
    console.error(`   Client: ${clientName}`);
    console.error(`   Symbol: ${document.symbol}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);

    // Save failed primary order to database
    try {
      console.log("💾 MOTILAL OSWAL - Saving failed primary order to database...");
      const failedPrimaryRecord = new OrderResponse({
        clientName: clientName,
        broker: "MOTILAL",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: "FAILED",
        response: { error: error.message, orderData: orderData },
      });
      await failedPrimaryRecord.save();
      console.log("✅ MOTILAL OSWAL - Failed primary order saved to database");
    } catch (dbError) {
      console.error("❌ MOTILAL OSWAL - Error saving failed primary order to database:", dbError.message);
    }

    console.log("=".repeat(50));
    return { success: false, error: error.message };
  }
}

// Function to adjust price based on transaction type
function adjustPriceForTransaction(price, transactionType) {
  console.log(`🔧 MOTILAL OSWAL - Adjusting price for ${transactionType.toUpperCase()}`);
  console.log(`   Original Price: ₹${price}`);

  if (transactionType.toUpperCase() === "BUY") {
    const adjustedPrice = price * BUY_ADJUSTMENT;
    console.log(`   BUY Adjustment Factor: ${BUY_ADJUSTMENT}`);
    console.log(`   Adjusted Price: ₹${adjustedPrice}`);
    return adjustedPrice;
  } else if (transactionType.toUpperCase() === "SELL") {
    const adjustedPrice = price * SELL_ADJUSTMENT;
    console.log(`   SELL Adjustment Factor: ${SELL_ADJUSTMENT}`);
    console.log(`   Adjusted Price: ₹${adjustedPrice}`);
    return adjustedPrice;
  }

  console.error(`❌ MOTILAL OSWAL - Invalid transaction type: ${transactionType}`);
  throw new Error("Invalid transaction type");
}

// Function to create order data
function createOrderData(document, transactionType, price, quantity) {
  console.log("📋 MOTILAL OSWAL - Creating primary order data");
  console.log(`   Symbol: ${document.symbol}`);
  console.log(`   Token: ${document.token}`);
  console.log(`   Transaction Type: ${transactionType.toUpperCase()}`);
  console.log(`   Price: ₹${price}`);
  console.log(`   Quantity: ${quantity}`);

  const token = Number(document.token);
  const roundedPrice = Number(roundToTwoDecimalsEndingInZero(price));

  console.log(`   Rounded Price: ₹${roundedPrice}`);

  const orderData = {
    exchange: "NSE",
    symboltoken: token,
    buyorsell: transactionType.toUpperCase(),
    ordertype: "LIMIT",
    producttype: "VALUEPLUS",
    orderduration: "DAY",
    price: roundedPrice,
    quantityinlot: quantity,
    amoorder: "N",
  };

  console.log("✅ MOTILAL OSWAL - Primary order data created successfully");
  return orderData;
}

// Function to create stop-loss order data
function createStopLossOrderData(
  document,
  transactionType,
  messagePrice,
  stopLossPrice,
  quantity
) {
  console.log("🛑 MOTILAL OSWAL - Creating stop-loss order data");
  console.log(`   Symbol: ${document.symbol}`);
  console.log(`   Original Transaction: ${transactionType.toUpperCase()}`);
  console.log(`   Message Price: ₹${messagePrice}`);
  console.log(`   Stop Loss Price: ₹${stopLossPrice}`);
  console.log(`   Quantity: ${quantity}`);

  // For stop loss, we need to reverse the transaction type
  const reversedTransactionType =
    transactionType.toUpperCase() === "BUY" ? "SELL" : "BUY";

  console.log(`   Reversed Transaction (for stop-loss): ${reversedTransactionType}`);

  // Check if stopLossPrice is undefined or null
  if (stopLossPrice === undefined || stopLossPrice === null) {
    console.log("🔄 MOTILAL OSWAL - Calculating default stop-loss price (2.5%)");
    // Calculate default stop loss price (2.5% from message price)
    if (transactionType.toUpperCase() === "SELL") {
      // For SELL orders, stop loss is 2.5% above the message price
      stopLossPrice = messagePrice * 1.025;
      console.log(`   SELL order: Stop-loss = ${messagePrice} * 1.025 = ₹${stopLossPrice}`);
    } else {
      // For BUY orders, stop loss is 2.5% below the message price
      stopLossPrice = messagePrice * 0.975;
      console.log(`   BUY order: Stop-loss = ${messagePrice} * 0.975 = ₹${stopLossPrice}`);
    }
  } else {
    console.log("✅ MOTILAL OSWAL - Using provided stop-loss price");
  }

  // For a SELL order, the stop loss is a BUY order with a trigger price above the current price
  // For a BUY order, the stop loss is a SELL order with a trigger price below the current price
  let triggerPrice;
  let stopLossOrderPrice;

  console.log("🔧 MOTILAL OSWAL - Calculating trigger and order prices");

  if (transactionType.toUpperCase() === "SELL") {
    // For SELL orders, the stop loss is a BUY order
    // The trigger price is the stop loss price from the message
    triggerPrice = stopLossPrice;
    // The stop loss order price should be 0.25% above the trigger price
    stopLossOrderPrice = triggerPrice * 1.0025;
    console.log(`   SELL order stop-loss calculation:`);
    console.log(`   Trigger Price: ₹${triggerPrice}`);
    console.log(`   Order Price: ${triggerPrice} * 1.0025 = ₹${stopLossOrderPrice}`);
  } else {
    // For BUY orders, the stop loss is a SELL order
    // The trigger price is the stop loss price from the message
    triggerPrice = stopLossPrice;
    // The stop loss order price should be 0.25% below the trigger price
    stopLossOrderPrice = triggerPrice * 0.9975;
    console.log(`   BUY order stop-loss calculation:`);
    console.log(`   Trigger Price: ₹${triggerPrice}`);
    console.log(`   Order Price: ${triggerPrice} * 0.9975 = ₹${stopLossOrderPrice}`);
  }

  // Round all prices to two decimal places ending in zero
  console.log("🔄 MOTILAL OSWAL - Rounding prices to tick size");
  const roundedStopLossPrice =
    roundToTwoDecimalsEndingInZero(stopLossOrderPrice);
  const roundedTriggerPrice = roundToTwoDecimalsEndingInZero(triggerPrice);

  console.log(`   Rounded Order Price: ₹${roundedStopLossPrice}`);
  console.log(`   Rounded Trigger Price: ₹${roundedTriggerPrice}`);

  // Ensure we have valid numeric values
  const finalStopLossPrice = Number(roundedStopLossPrice);
  const finalTriggerPrice = Number(roundedTriggerPrice);

  // Validate the values
  if (isNaN(finalStopLossPrice) || isNaN(finalTriggerPrice)) {
    console.error("❌ MOTILAL OSWAL - Invalid price values for stop loss order");
    console.error(`   Final Stop Loss Price: ${finalStopLossPrice}`);
    console.error(`   Final Trigger Price: ${finalTriggerPrice}`);
    throw new Error("Invalid price values for stop loss order");
  }

  console.log("✅ MOTILAL OSWAL - Price validation passed");

  const orderData = {
    exchange: "NSE",
    symboltoken: Number(document.token),
    buyorsell: reversedTransactionType,
    ordertype: "STOPLOSS",
    producttype: "VALUEPLUS",
    orderduration: "DAY",
    price: finalStopLossPrice,
    triggerprice: finalTriggerPrice,
    quantityinlot: quantity,
    amoorder: "N",
  };

  return orderData;
}

// Round function for stop loss prices
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
  return rounded;
}

// Function to place order via API
async function placeOrder(orderData, credentials, authToken, apiKey, userId) {
  console.log("🌐 MOTILAL OSWAL API - Preparing order request");
  console.log("=".repeat(60));
  console.log("📋 Request Details:");
  console.log(`   URL: https://openapi.motilaloswal.com/rest/trans/v1/placeorder`);
  console.log(`   Method: POST`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Order Type: ${orderData.ordertype}`);
  console.log(`   Symbol Token: ${orderData.symboltoken}`);
  console.log(`   Transaction: ${orderData.buyorsell}`);
  console.log(`   Price: ₹${orderData.price}`);
  console.log(`   Quantity: ${orderData.quantityinlot}`);

  if (orderData.triggerprice) {
    console.log(`   Trigger Price: ₹${orderData.triggerprice}`);
  }

  console.log("📡 Request Headers:");
  console.log(`   Authorization: ${authToken ? authToken.substring(0, 20) + '...' : 'N/A'}`);
  console.log(`   ApiKey: ${apiKey ? apiKey.substring(0, 10) + '...' : 'N/A'}`);
  console.log(`   ClientLocalIp: ${credentials.localIp}`);
  console.log(`   ClientPublicIp: ${credentials.publicIp}`);
  console.log(`   MacAddress: ${credentials.macAddress}`);

  console.log("📦 Request Body:");
  console.log(JSON.stringify(orderData, null, 2));

  const config = {
    method: "post",
    url: "https://openapi.motilaloswal.com/rest/trans/v1/placeorder",
    headers: {
      Accept: "application/json",
      "User-Agent": "MOSL/V.1.1.0",
      Authorization: authToken,
      ApiKey: apiKey,
      ClientLocalIp: credentials.localIp,
      ClientPublicIp: credentials.publicIp,
      MacAddress: credentials.macAddress,
      SourceId: "WEB",
      vendorinfo: userId,
      osname: "Windows-10",
      osversion: "10.0.19041",
      devicemodel: "AHV",
      manufacturer: "DELL",
      productname: "Dellserver",
      productversion: "m3-48vcpu-384gb-intel",
      installedappid: "AppID",
      browsername: "Chrome",
      browserversion: "105.0",
    },
    data: JSON.stringify(orderData),
  };

  const startTime = Date.now();

  try {
    console.log("🚀 MOTILAL OSWAL API - Sending request...");

    const response = await axios(config);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log("✅ MOTILAL OSWAL API - Response received successfully");
    console.log("=".repeat(60));
    console.log("📊 Response Details:");
    console.log(`   Status Code: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);

    console.log("📦 Response Body:");
    console.log(JSON.stringify(response.data, null, 2));

    // Check if the response indicates success or failure
    if (response.data) {
      if (response.data.status === 'SUCCESS' || response.data.success === true) {
        console.log("🎉 MOTILAL OSWAL API - Order placed successfully!");
        if (response.data.orderid || response.data.orderId) {
          console.log(`   Order ID: ${response.data.orderid || response.data.orderId}`);
        }
      } else if (response.data.status === 'FAILED' || response.data.success === false) {
        console.log("⚠️ MOTILAL OSWAL API - Order placement failed");
        if (response.data.message || response.data.error) {
          console.log(`   Error Message: ${response.data.message || response.data.error}`);
        }
      } else {
        console.log("ℹ️ MOTILAL OSWAL API - Response status unclear, check response body above");
      }
    }

    console.log("=".repeat(60));
    return response.data;

  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.error("❌ MOTILAL OSWAL API - Request failed");
    console.error("=".repeat(60));
    console.error("🔍 Error Details:");
    console.error(`   Response Time: ${responseTime}ms`);
    console.error(`   Error Type: ${error.name}`);
    console.error(`   Error Message: ${error.message}`);

    if (error.response) {
      console.error("📡 HTTP Response Error:");
      console.error(`   Status Code: ${error.response.status}`);
      console.error(`   Status Text: ${error.response.statusText}`);
      console.error(`   Headers:`, JSON.stringify(error.response.headers, null, 2));
      console.error("📦 Error Response Body:");
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("📡 Network Error - No response received:");
      console.error(`   Request Config:`, JSON.stringify({
        method: error.config?.method,
        url: error.config?.url,
        timeout: error.config?.timeout
      }, null, 2));
    } else {
      console.error("⚙️ Request Setup Error:");
      console.error(`   Error during request setup: ${error.message}`);
    }

    console.error("📚 Full Error Stack:");
    console.error(error.stack);
    console.error("=".repeat(60));

    throw error;
  }
}

module.exports = {
  placeOrder,
  createStopLossOrderData,
  createOrderData,
  handleClientOrder,
};
