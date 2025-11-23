const axios = require("axios");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const OrderResponse = require("../../../../models/OrderResponse");
const {
  BUY_ADJUSTMENT,
  SELL_ADJUSTMENT,
  TRIGGER_ABOVE,
  STOPLOSS_ABOVE,
  TRIGGER_BELOW,
  STOPLOSS_BELOW,
} = require("../../Utils/utilities");

async function angelhandleClientOrder(
  client,
  document,
  price,
  transactionType,
  credentials,
  stopLossPrice
) {
  const { clientName, jwtToken, apiKey, capital } = client;

  console.log(`Starting order processing for Angel client: ${clientName}`);

  if (!jwtToken || !apiKey || !capital) {
    console.error(`Angel client ${clientName} missing required fields:`, {
      hasJwtToken: !!jwtToken,
      hasApiKey: !!apiKey,
      hasCapital: !!capital
    });
    return { success: false, error: "Missing required client credentials" };
  }

  if (!document || !document.symbol || !document.token) {
    console.error(`Invalid document for Angel client ${clientName}:`, document);
    return { success: false, error: "Invalid symbol document" };
  }

  const adjustedPrice = adjustPriceForTransaction(price, transactionType);
  console.log(`Angel client ${clientName}: Adjusted price from ${price} to ${adjustedPrice} for ${transactionType}`);

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
    console.log(`Angel client ${clientName}: Calculated default stop loss: ${stopLossPrice}`);
  }

  const quantity = Math.floor(capital / adjustedPrice);
  console.log(`Angel client ${clientName}: Calculated quantity: ${quantity} (capital: ${capital}, price: ${adjustedPrice})`);

  if (quantity <= 0) {
    console.error(`Angel client ${clientName}: Invalid quantity calculated: ${quantity}`);
    return { success: false, error: "Insufficient capital for order" };
  }

  const orderData = angelcreateOrderData(
    document,
    transactionType,
    adjustedPrice,
    quantity
  );

  try {
    console.log(`Angel client ${clientName}: Placing primary order...`);
    const response = await angelplaceOrder(
      orderData,
      credentials,
      jwtToken,
      apiKey
    );

    console.log(`Angel client ${clientName}: Primary order response:`, response);

    // Save primary order response to database
    try {
      const primaryOrderRecord = new OrderResponse({
        clientName: clientName,
        broker: "ANGEL",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: response && response.status ? "SUCCESS" : "FAILED",
        response: response,
      });
      await primaryOrderRecord.save();
      console.log(`Angel client ${clientName}: Primary order saved to database`);

      // Broadcast order update via WebSocket
      if (global.wsManager) {
        global.wsManager.broadcastNewOrder({
          clientName,
          broker: "ANGEL",
          symbol: document.symbol,
          transactionType: transactionType.toUpperCase(),
          price: adjustedPrice,
          quantity: quantity,
          status: response && response.status ? "SUCCESS" : "FAILED"
        });
      }
    } catch (dbError) {
      console.error(`Angel client ${clientName}: Failed to save primary order to database:`, dbError);
    }

    setTimeout(async () => {
      const stopLossOrderData = angelcreateStopLossOrderData(
        document,
        transactionType,
        price,
        stopLossPrice,
        quantity
      );

      try {
        const stopLossResponse = await angelplaceOrder(
          stopLossOrderData,
          credentials,
          jwtToken,
          apiKey
        );

        // Save stop-loss order response to database
        try {
          const stopLossOrderRecord = new OrderResponse({
            clientName: clientName,
            broker: "ANGEL",
            symbol: document.symbol,
            transactionType: stopLossOrderData.transactiontype,
            orderType: "STOPLOSS",
            price: parseFloat(stopLossOrderData.price),
            quantity: quantity,
            status: stopLossResponse && stopLossResponse.status ? "SUCCESS" : "FAILED",
            response: stopLossResponse,
          });
          await stopLossOrderRecord.save();
        } catch (dbError) {
          // Error saving stop-loss order to database - silently handled
        }
      } catch (error) {
        // Save failed stop-loss order to database
        try {
          const failedStopLossRecord = new OrderResponse({
            clientName: clientName,
            broker: "ANGEL",
            symbol: document.symbol,
            transactionType: stopLossOrderData.transactiontype,
            orderType: "STOPLOSS",
            price: parseFloat(stopLossOrderData.price),
            quantity: quantity,
            status: "FAILED",
            response: { error: error.message, orderData: stopLossOrderData },
          });
          await failedStopLossRecord.save();
        } catch (dbError) {
          // Error saving failed stop-loss order to database - silently handled
        }
      }
    }, 5000);

    return { success: true, message: "Primary order placed successfully, stop-loss order will be placed shortly" };
  } catch (error) {
    console.error(`Angel client ${clientName}: Primary order failed:`, error);

    // Save failed primary order to database
    try {
      const failedPrimaryRecord = new OrderResponse({
        clientName: clientName,
        broker: "ANGEL",
        symbol: document.symbol,
        transactionType: transactionType.toUpperCase(),
        orderType: "PRIMARY",
        price: adjustedPrice,
        quantity: quantity,
        status: "FAILED",
        response: { error: error.message, orderData: orderData },
      });
      await failedPrimaryRecord.save();
      console.log(`Angel client ${clientName}: Failed primary order saved to database`);
    } catch (dbError) {
      console.error(`Angel client ${clientName}: Failed to save failed primary order to database:`, dbError);
    }

    return { success: false, error: error.message };
  }
}

// Function to adjust price based on transaction type
function adjustPriceForTransaction(price, transactionType) {
  if (transactionType.toUpperCase() === "BUY") {
    const adjustedPrice = price * BUY_ADJUSTMENT;
    return adjustedPrice;
  } else if (transactionType.toUpperCase() === "SELL") {
    const adjustedPrice = price * SELL_ADJUSTMENT;
    return adjustedPrice;
  }

  throw new Error("Invalid transaction type");
}

// Function to create order data
function angelcreateOrderData(document, transactionType, price, quantity) {
  const orderData = {
    variety: "NORMAL",
    tradingsymbol: document.symbol,
    symboltoken: document.token,
    transactiontype: transactionType.toUpperCase(),
    exchange: "NSE",
    ordertype: "LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    price: roundToTwoDecimalsEndingInZero(price),
    quantity,
  };

  return orderData;
}

// Function to create stop-loss order data
function angelcreateStopLossOrderData(
  document,
  transactionType,
  messagePrice,
  stopLossPrice,
  quantity
) {
  // For stop loss, we need to reverse the transaction type
  const reversedTransactionType =
    transactionType.toUpperCase() === "BUY" ? "SELL" : "BUY";

  // Check if stopLossPrice is undefined or null
  if (stopLossPrice === undefined || stopLossPrice === null) {
    // Calculate default stop loss price (2.5% from message price)
    if (transactionType.toUpperCase() === "SELL") {
      // For SELL orders, stop loss is 2.5% above the message price
      stopLossPrice = messagePrice * 1.025;
    } else {
      // For BUY orders, stop loss is 2.5% below the message price
      stopLossPrice = messagePrice * 0.975;
    }
  }

  // For a SELL order, the stop loss is a BUY order with a trigger price above the current price
  // For a BUY order, the stop loss is a SELL order with a trigger price below the current price
  let triggerPrice;
  let stopLossOrderPrice;

  if (transactionType.toUpperCase() === "SELL") {
    // For SELL orders, the stop loss is a BUY order
    // The trigger price is the stop loss price from the message
    triggerPrice = stopLossPrice;
    // The stop loss order price should be 0.25% above the trigger price
    stopLossOrderPrice = triggerPrice * 1.0025;
  } else {
    // For BUY orders, the stop loss is a SELL order
    // The trigger price is the stop loss price from the message
    triggerPrice = stopLossPrice;
    // The stop loss order price should be 0.25% below the trigger price
    stopLossOrderPrice = triggerPrice * 0.9975;
  }

  // Round all prices to two decimal places ending in zero
  const roundedStopLossPrice =
    roundToTwoDecimalsEndingInZero(stopLossOrderPrice);
  const roundedTriggerPrice = roundToTwoDecimalsEndingInZero(triggerPrice);

  // Ensure we have valid numeric values
  const finalStopLossPrice = roundedStopLossPrice;
  const finalTriggerPrice = roundedTriggerPrice;

  // Validate the values
  if (isNaN(finalStopLossPrice) || isNaN(finalTriggerPrice)) {
    throw new Error("Invalid price values for stop loss order");
  }

  const orderData = {
    variety: "STOPLOSS",
    tradingsymbol: document.symbol,
    symboltoken: document.token,
    transactiontype: reversedTransactionType,
    exchange: "NSE",
    ordertype: "STOPLOSS_LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    price: finalStopLossPrice, // Stop-loss price
    triggerprice: finalTriggerPrice, // Trigger price
    quantity: quantity,
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

  const rounded = (Math.round(value / tickSize) * tickSize).toFixed(2);
  return rounded;
}

// Function to place order via API
async function angelplaceOrder(orderData, credentials, jwtToken, apiKey) {
  try {
    const response = await axios.post(
      "https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder",
      orderData,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "CLIENT_LOCAL_IP",
          "X-ClientPublicIP": "CLIENT_PUBLIC_IP",
          "X-MACAddress": "MAC_ADDRESS",
          "X-PrivateKey": apiKey,
        },
      }
    );

    return response.data;
  } catch (error) {
    // API error - silently handled
    throw error;
  }
}

module.exports = {
  angelhandleClientOrder,
  angelcreateOrderData,
  angelcreateStopLossOrderData,
};
