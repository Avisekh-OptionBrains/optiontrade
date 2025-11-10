const DhanClient = require("./dhanClient");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const IIFLUser = require("../../../../models/IIFLUser");
const { sendMessageToTelegram } = require("../../../Epicrise/Utils/utilities");

/**
 * Read CSV file and create security ID map
 */
function readSecurityIdMap() {
  const csvPath = path.join(__dirname, "../../../../../data.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n");
  const securityIdMap = {};

  // Skip header and empty lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.split(",").every((cell) => !cell)) continue;

    const columns = line.split(",");
    const securityId = columns[2]; // SECURITY_ID
    const strikePrice = columns[13]; // STRIKE_PRICE
    const optionType = columns[14]; // OPTION_TYPE (CE or PE)

    if (securityId && strikePrice && optionType) {
      const key = `${strikePrice}_${optionType}`;
      securityIdMap[key] = parseInt(securityId);
    }
  }

  return securityIdMap;
}

/**
 * Parse BB TRAP signal
 * Example: "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"
 */
function parseBBTrapSignal(signalText) {
  const regex = /BB TRAP (Buy|Sell) (.+?) at ([\d.]+) \| SL: ([\d.]+) \| Target: ([\d.]+)/i;
  const match = signalText.match(regex);

  if (!match) {
    return null;
  }

  return {
    action: match[1].toLowerCase(), // "buy" or "sell"
    symbol: match[2].trim(), // "NIFTY1!"
    entryPrice: parseFloat(match[3]),
    stopLoss: parseFloat(match[4]),
    target: parseFloat(match[5]),
  };
}

/**
 * IIFL API Base URL
 */
const IIFL_BASE_URL = "https://api.iiflcapital.com/v1";

/**
 * Place order for a single IIFL user for an option
 */
async function placeOrderForUser(user, order, signal) {
  const { clientName, token, capital, userID } = user;

  console.log(`\n📊 IIFL Client: ${clientName}`);
  console.log(`   💰 Capital: ₹${capital.toLocaleString()}`);
  console.log(`   🔑 Has Token: ${!!token}`);

  if (!token) {
    console.error(`❌ Missing token for ${clientName}`);
    return { success: false, error: `Missing token for ${clientName}`, clientName };
  }

  try {
    // Fixed quantity of 75 lots (not based on capital)
    const quantity = 75;

    console.log(`📈 Placing ${order.action} order for ${quantity} lots of ${order.type} Strike ${order.strike} at ₹${order.price}`);

    // IIFL Order payload for options
    const orderPayload = [{
      instrumentId: order.security_id, // Security ID from Dhan CSV
      exchange: "NSEFO", // Options are on NSE F&O
      transactionType: order.action.toUpperCase(), // BUY or SELL
      quantity: quantity.toString(),
      orderComplexity: "REGULAR",
      product: "INTRADAY",
      orderType: "LIMIT",
      validity: "DAY",
      price: parseFloat(order.price).toString(),
      apiOrderSource: "OptionTradeStrategy",
      orderTag: `BBTrap_${order.type}_${order.strike}_${Date.now()}`
    }];

    console.log(`📡 IIFL Order Payload for ${clientName}:`);
    console.log(JSON.stringify(orderPayload, null, 2));

    // Place order via IIFL API
    console.log(`🚀 Sending order to IIFL for ${clientName}...`);
    const response = await axios.post(
      `${IIFL_BASE_URL}/orders`,
      orderPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        timeout: 30000
      }
    );

    console.log(`✅ Order placed for ${clientName}:`, JSON.stringify(response.data, null, 2));

    // No stop-loss orders - only primary orders

    return {
      success: true,
      data: response.data,
      clientName,
      quantity,
      price: order.price,
      order
    };

  } catch (error) {
    console.error(`❌ Error placing order for ${clientName}:`, error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
      clientName,
      order
    };
  }
}

/**
 * Place option orders for all IIFL users
 */
async function placeOptionOrders(signal, ceStrike, peStrike) {
  const { action, symbol, entryPrice, stopLoss, target } = signal;

  console.log("\n=== PLACING OPTION ORDERS ===");
  console.log(`Signal: ${action.toUpperCase()} ${symbol} at ${entryPrice}`);
  console.log(`Stop Loss: ${stopLoss} | Target: ${target}`);
  console.log(`CE Strike: ${ceStrike.strike} (Delta: ${ceStrike.delta}, Security ID: ${ceStrike.security_id})`);
  console.log(`PE Strike: ${peStrike.strike} (Delta: ${peStrike.delta}, Security ID: ${peStrike.security_id})`);

  const orders = [];

  if (action === "buy") {
    // Buy signal: BUY CE and SELL PE
    orders.push({
      type: "CE",
      action: "BUY",
      strike: ceStrike.strike,
      delta: ceStrike.delta,
      price: ceStrike.top_ask_price,
      security_id: ceStrike.security_id,
    });

    orders.push({
      type: "PE",
      action: "SELL",
      strike: peStrike.strike,
      delta: peStrike.delta,
      price: peStrike.top_ask_price,
      security_id: peStrike.security_id,
    });
  } else {
    // Sell signal: SELL CE and BUY PE
    orders.push({
      type: "CE",
      action: "SELL",
      strike: ceStrike.strike,
      delta: ceStrike.delta,
      price: ceStrike.top_ask_price,
      security_id: ceStrike.security_id,
    });

    orders.push({
      type: "PE",
      action: "BUY",
      strike: peStrike.strike,
      delta: peStrike.delta,
      price: peStrike.top_ask_price,
      security_id: peStrike.security_id,
    });
  }

  console.log("\n📋 Orders to be placed:");
  orders.forEach((order, index) => {
    console.log(`${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price} (Security ID: ${order.security_id})`);
  });

  // Get all IIFL users
  console.log("\n🔍 Fetching IIFL users...");
  const users = await IIFLUser.find({ state: "live" });

  if (!users || users.length === 0) {
    console.log("⚠️ No IIFL users found");
    return { orders, results: [] };
  }

  console.log(`✅ Found ${users.length} IIFL users`);

  // Place orders for all users
  const results = [];

  for (const order of orders) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 Placing ${order.action} ${order.type} orders for all users...`);
    console.log(`${'='.repeat(60)}`);

    for (const user of users) {
      const result = await placeOrderForUser(user, order, signal);
      results.push(result);

      // Add delay between orders to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n📊 Order Summary: ${successful} successful, ${failed} failed out of ${results.length} total orders`);

  return { orders, results };
}

/**
 * Send Telegram notification for BB TRAP signal
 */
async function sendTelegramNotification(signal, orders, results) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!botToken || !channelId) {
      console.log("⚠️ Telegram credentials not configured, skipping notification");
      return { success: false, error: "Telegram not configured" };
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Create formatted message
    let message = `🎯 BB TRAP OPTION TRADE\n\n`;
    message += `📊 Signal: ${signal.action.toUpperCase()} ${signal.symbol}\n`;
    message += `💰 Entry: ₹${signal.entryPrice}\n`;
    message += `🛑 Stop Loss: ₹${signal.stopLoss}\n`;
    message += `🎯 Target: ₹${signal.target}\n\n`;

    message += `📋 Orders Placed:\n`;
    orders.forEach((order, index) => {
      message += `${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price}\n`;
    });

    message += `\n✅ Successful: ${successful}\n`;
    message += `❌ Failed: ${failed}\n`;
    message += `📊 Total: ${results.length} orders\n\n`;
    message += `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

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

/**
 * Save trade to database or JSON file
 */
async function saveTradeToDatabase(signal, orders, results) {
  try {
    // Try to save to MongoDB
    const Trade = require("../../../../../models/Trade");

    const trade = new Trade({
      strategy: "BB TRAP",
      signal: signal,
      orders: orders,
      results: results,
      status: results.every((r) => r.success) ? "ACTIVE" : "FAILED",
    });

    await trade.save();

    console.log(`\n✅ Trade saved to database with ID: ${trade._id}`);
    return trade;
  } catch (error) {
    console.error("❌ Error saving trade to database:", error.message);

    // Fallback: Save to JSON file
    const tradesFile = path.join(__dirname, "../../../../../trades_backup.json");
    let trades = [];

    if (fs.existsSync(tradesFile)) {
      const content = fs.readFileSync(tradesFile, "utf-8");
      trades = JSON.parse(content);
    }

    trades.push({
      timestamp: new Date().toISOString(),
      strategy: "BB TRAP",
      signal,
      orders,
      results,
    });

    fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
    console.log(`⚠️ Trade saved to backup file: ${tradesFile}`);

    return null;
  }
}

/**
 * Main function to process BB TRAP signal
 */
async function processBBTrapSignal(signalText) {
  try {
    console.log("=== BB TRAP SIGNAL PROCESSOR ===\n");
    console.log(`Received Signal: ${signalText}\n`);

    // Parse the signal
    const signal = parseBBTrapSignal(signalText);
    if (!signal) {
      console.error("❌ Failed to parse signal");
      return { success: false, error: "Failed to parse signal" };
    }

    console.log("✅ Signal parsed successfully:");
    console.log(JSON.stringify(signal, null, 2));

    // Initialize Dhan Client
    const dhanClient = new DhanClient();

    // Read CSV and create security ID map
    console.log("\n1. Reading CSV file and mapping security IDs...");
    const securityIdMap = readSecurityIdMap();
    console.log(`✅ Security ID map created with ${Object.keys(securityIdMap).length} entries\n`);

    // Get Expiry List for NIFTY
    console.log("2. Fetching expiry list for NIFTY...");
    const expiryList = await dhanClient.getExpiryList(13, "IDX_I");
    console.log(`✅ Available expiries: ${expiryList.data.length}`);
    console.log(`   First expiry: ${expiryList.data[0]}\n`);

    // Get Option Chain
    const firstExpiry = expiryList.data[0];
    console.log(`3. Fetching option chain for expiry: ${firstExpiry}...`);
    const optionChain = await dhanClient.getOptionChain(13, "IDX_I", firstExpiry);
    console.log(`✅ Option chain fetched`);
    console.log(`   Underlying Last Price: ${optionChain.data.last_price}\n`);

    // Get strikes with delta closest to 0.50
    console.log("4. Finding strikes with delta closest to 0.50...");
    const delta50Strikes = dhanClient.getDelta50Strikes(optionChain, securityIdMap);

    console.log("\n=== DELTA 0.50 STRIKES ===");
    console.log(JSON.stringify(delta50Strikes, null, 2));

    // Place option orders
    const { orders, results } = await placeOptionOrders(signal, delta50Strikes.ce, delta50Strikes.pe);

    // Send Telegram notification
    console.log("\n5. Sending Telegram notification...");
    const telegramResult = await sendTelegramNotification(signal, orders, results);
    if (telegramResult.success) {
      console.log(`✅ Telegram notification sent (Message ID: ${telegramResult.messageId})`);
    } else {
      console.log(`⚠️ Telegram notification failed: ${telegramResult.error}`);
    }

    // Save trade to database
    const savedTrade = await saveTradeToDatabase(signal, orders, results);

    console.log("\n=== PROCESSING COMPLETE ===");

    return {
      success: true,
      signal,
      orders,
      results,
      trade: savedTrade,
      telegram: telegramResult,
    };
  } catch (error) {
    console.error("❌ Error processing BB TRAP signal:", error.message);
    console.error("Stack trace:", error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  processBBTrapSignal,
  parseBBTrapSignal,
  placeOptionOrders,
  saveTradeToDatabase,
  readSecurityIdMap,
};

