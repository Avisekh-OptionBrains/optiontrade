const DhanClient = require("./dhanClient");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const IIFLUser = require("../../../../models/IIFLUser");
const { sendMessageToTelegram } = require("../../../Epicrise/Utils/utilities");

/**
 * Read CSV file and create security ID map for BankNifty
 */
function readSecurityIdMap() {
  // Use local data folder - path from Brokers/IIFL/ to BankNifty/data/
  // __dirname = .../Strategies/BankNifty/Brokers/IIFL
  // ../../data = .../Strategies/BankNifty/data
  const csvPath = path.join(__dirname, "../../data/bankniftydata.csv");

  console.log(`📂 Reading BankNifty CSV file from local data folder...`);
  console.log(`   Path: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ BankNifty CSV file not found at: ${csvPath}`);
    throw new Error(`BankNifty CSV file not found at: ${csvPath}`);
  }

  console.log(`✅ CSV file found!`);

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n");
  
  // Skip header line
  const dataLines = lines.slice(1);
  
  const securityMap = {};
  
  dataLines.forEach((line, index) => {
    if (!line.trim()) return;
    
    const columns = line.split(",");
    
    // Column indices (0-based):
    // 2: SECURITY_ID
    // 13: STRIKE_PRICE
    // 14: OPTION_TYPE
    
    const securityId = columns[2]?.trim();
    const strikePrice = columns[13]?.trim();
    const optionType = columns[14]?.trim();
    
    if (securityId && strikePrice && optionType) {
      const key = `${strikePrice}_${optionType}`;
      securityMap[key] = parseInt(securityId);
    }
  });
  
  console.log(`✅ Security ID map created with ${Object.keys(securityMap).length} entries`);
  
  return securityMap;
}

/**
 * Parse BB TRAP signal
 * Format: "BB TRAP Buy/Sell SYMBOL at PRICE | SL: PRICE | Target: PRICE"
 */
function parseBBTrapSignal(messageText) {
  const regex = /BB TRAP (Buy|Sell) (.+?) at ([\d.]+) \| SL: ([\d.]+) \| Target: ([\d.]+)/i;
  const match = messageText.match(regex);

  if (!match) {
    return null;
  }

  return {
    action: match[1].toLowerCase(), // "buy" or "sell"
    symbol: match[2].trim(), // "BANKNIFTY" or similar
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
async function placeOrderForUser(user, order) {
  const { clientName, token, capital, userID } = user;

  console.log(`\n📊 IIFL Client: ${clientName}`);
  console.log(`   💰 Capital: ₹${capital.toLocaleString()}`);
  console.log(`   🔑 Has Token: ${!!token}`);

  if (!token) {
    console.error(`❌ Missing token for ${clientName}`);
    return { success: false, error: `Missing token for ${clientName}`, clientName };
  }

  try {
    // Fixed quantity of 35 lots for BankNifty (not based on capital)
    const quantity = 35;

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
      apiOrderSource: "BankNiftyStrategy",
      orderTag: `BBTrap_BankNifty_${order.type}_${order.strike}_${Date.now()}`
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

  console.log("\n=== PLACING BANKNIFTY OPTION ORDERS ===");
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
      security_id: ceStrike.security_id
    });
    orders.push({
      type: "PE",
      action: "SELL",
      strike: peStrike.strike,
      delta: peStrike.delta,
      price: peStrike.top_ask_price,
      security_id: peStrike.security_id
    });
  } else {
    // Sell signal: SELL CE and BUY PE
    orders.push({
      type: "CE",
      action: "SELL",
      strike: ceStrike.strike,
      delta: ceStrike.delta,
      price: ceStrike.top_ask_price,
      security_id: ceStrike.security_id
    });
    orders.push({
      type: "PE",
      action: "BUY",
      strike: peStrike.strike,
      delta: peStrike.delta,
      price: peStrike.top_ask_price,
      security_id: peStrike.security_id
    });
  }

  console.log(`\n📋 Orders to be placed:`);
  orders.forEach((order, index) => {
    console.log(`${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price} (Security ID: ${order.security_id})`);
  });

  // Get all IIFL users
  console.log(`\n🔍 Fetching IIFL users...`);
  const users = await IIFLUser.find({ state: "live" });
  console.log(`✅ Found ${users.length} IIFL users`);

  if (users.length === 0) {
    console.log(`⚠️ No IIFL users found`);
    return { orders, results: [] };
  }

  // Place orders for all users
  const results = [];
  
  for (const order of orders) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📤 Placing ${order.action} ${order.type} orders for all users...`);
    console.log("=".repeat(60));
    
    for (const user of users) {
      const result = await placeOrderForUser(user, order);
      results.push(result);
      
      // Wait 1 second between orders to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\n📊 Order Summary: ${successful} successful, ${failed} failed out of ${results.length} total orders`);

  return { orders, results };
}

/**
 * Find strikes with delta closest to 0.50
 */
function findDelta50Strikes(optionChainData, securityMap) {
  // Extract data from the correct structure
  const strikes = optionChainData.data?.oc || optionChainData.data;
  const lastPrice = optionChainData.data?.last_price || optionChainData.last_price;

  console.log(`\n📊 Finding strikes with delta closest to 0.50...`);
  console.log(`   Last Price: ${lastPrice}`);
  console.log(`   Total strikes available: ${Object.keys(strikes || {}).length}`);

  let closestCE = null;
  let closestPE = null;
  let minCEDiff = Infinity;
  let minPEDiff = Infinity;

  Object.keys(strikes || {}).forEach(strikePrice => {
    const strikeData = strikes[strikePrice];

    // Check CE (Call) - delta is inside greeks
    if (strikeData.ce && strikeData.ce.greeks && strikeData.ce.greeks.delta !== undefined) {
      const ceDelta = strikeData.ce.greeks.delta;
      const diff = Math.abs(ceDelta - 0.50);

      if (diff < minCEDiff) {
        minCEDiff = diff;
        const securityId = securityMap[`${parseFloat(strikePrice)}_CE`];
        closestCE = {
          strike: parseFloat(strikePrice),
          delta: parseFloat(ceDelta.toFixed(2)),
          top_ask_price: parseFloat((strikeData.ce.top_ask_price || 0).toFixed(2)),
          security_id: securityId
        };
        console.log(`   ✅ Found CE: Strike ${closestCE.strike}, Delta ${closestCE.delta}, Price ${closestCE.top_ask_price}`);
      }
    }

    // Check PE (Put) - delta is inside greeks
    if (strikeData.pe && strikeData.pe.greeks && strikeData.pe.greeks.delta !== undefined) {
      const peDelta = strikeData.pe.greeks.delta;
      const diff = Math.abs(peDelta - (-0.50));

      if (diff < minPEDiff) {
        minPEDiff = diff;
        const securityId = securityMap[`${parseFloat(strikePrice)}_PE`];
        closestPE = {
          strike: parseFloat(strikePrice),
          delta: parseFloat(peDelta.toFixed(2)),
          top_ask_price: parseFloat((strikeData.pe.top_ask_price || 0).toFixed(2)),
          security_id: securityId
        };
        console.log(`   ✅ Found PE: Strike ${closestPE.strike}, Delta ${closestPE.delta}, Price ${closestPE.top_ask_price}`);
      }
    }
  });

  const result = {
    last_price: lastPrice,
    ce: closestCE,
    pe: closestPE
  };

  console.log("\n=== DELTA 0.50 STRIKES (BANKNIFTY) ===");
  console.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * Send Telegram notification for BB TRAP signal
 */
async function sendTelegramNotification(signal, orders, results) {
  try {
    // Use Epicrise Telegram credentials
    const botToken = process.env.TELEGRAM_BOT_TOKEN_EPICRISE;
    const channelId = process.env.TELEGRAM_CHANNEL_ID_EPICRISE;

    if (!botToken || !channelId) {
      console.log("⚠️ Telegram credentials not configured, skipping notification");
      console.log(`   TELEGRAM_BOT_TOKEN_EPICRISE: ${botToken ? 'Set' : 'Not set'}`);
      console.log(`   TELEGRAM_CHANNEL_ID_EPICRISE: ${channelId ? 'Set' : 'Not set'}`);
      return { success: false, error: "Telegram not configured" };
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Create formatted message
    let message = `🎯 BB TRAP BANKNIFTY OPTION TRADE\n\n`;
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
 * Get active trades for today
 */
async function getActiveTradesToday(symbol) {
  try {
    const Trade = require("../../../../models/Trade");

    // Get start of today (IST)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeTrades = await Trade.find({
      'signal.symbol': symbol,
      status: 'ACTIVE',
      createdAt: { $gte: todayStart }
    }).sort({ createdAt: -1 });

    console.log(`\n📊 Found ${activeTrades.length} active trade(s) for ${symbol} today`);
    return activeTrades;
  } catch (error) {
    console.error(`❌ Error fetching active trades: ${error.message}`);

    // Fallback: Check JSON backup file
    try {
      const tradesFile = path.join(__dirname, "../../data/trades_backup_banknifty.json");
      if (fs.existsSync(tradesFile)) {
        const fileContent = fs.readFileSync(tradesFile, "utf-8");
        const trades = JSON.parse(fileContent);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const activeTrades = trades.filter(t =>
          t.signal?.symbol === symbol &&
          t.status === 'ACTIVE' &&
          new Date(t.timestamp) >= todayStart
        );

        console.log(`\n📊 Found ${activeTrades.length} active trade(s) in backup file`);
        return activeTrades;
      }
    } catch (fileError) {
      console.error(`❌ Error reading backup file: ${fileError.message}`);
    }

    return [];
  }
}

/**
 * Square off existing positions
 */
async function squareOffPositions(activeTrade, dhanClient, securityMap) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           🔄 SQUARING OFF EXISTING POSITIONS              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`Previous Signal: ${activeTrade.signal.action.toUpperCase()} ${activeTrade.signal.symbol}`);
  console.log(`Previous Orders:`);
  activeTrade.orders.forEach((order, idx) => {
    console.log(`   ${idx + 1}. ${order.action} ${order.type} Strike ${order.strike} (Security ID: ${order.security_id})`);
  });

  try {
    // Fetch current option chain to get latest prices
    console.log("\n📊 Fetching current option chain for square-off prices...");
    const expiryList = await dhanClient.getExpiryList(25, "IDX_I"); // BankNifty
    const nearestExpiry = expiryList.data[0];
    const optionChainData = await dhanClient.getOptionChain(25, "IDX_I", nearestExpiry);

    console.log(`✅ Current option chain fetched`);
    console.log(`   Underlying Last Price: ${optionChainData.data?.last_price || optionChainData.last_price}`);

    // Get current prices for the strikes we need to square off
    const optionChain = optionChainData.data?.oc || optionChainData.data;
    const squareOffOrders = [];

    for (const order of activeTrade.orders) {
      // Find the strike in current option chain (option chain is an object with strike keys)
      const strikeKey = order.strike.toFixed(6); // Dhan uses 6 decimal places for strike keys
      const strikeData = optionChain[strikeKey];

      if (!strikeData) {
        console.error(`❌ Strike ${order.strike} not found in current option chain`);
        console.error(`   Available strikes: ${Object.keys(optionChain).slice(0, 5).join(', ')}...`);
        continue;
      }

      // Get current price for the option type
      let currentPrice;
      if (order.type === 'CE') {
        currentPrice = strikeData.ce?.top_ask_price || strikeData.ce?.ltp || order.price;
      } else {
        currentPrice = strikeData.pe?.top_ask_price || strikeData.pe?.ltp || order.price;
      }

      // Reverse the action: BUY becomes SELL, SELL becomes BUY
      const reverseAction = order.action === 'BUY' ? 'SELL' : 'BUY';

      squareOffOrders.push({
        type: order.type,
        action: reverseAction,
        strike: order.strike,
        price: currentPrice,
        security_id: order.security_id,
        originalAction: order.action,
        originalPrice: order.price
      });

      console.log(`\n🔄 Square-off order for ${order.type} Strike ${order.strike}:`);
      console.log(`   Original: ${order.action} at ₹${order.price}`);
      console.log(`   Square-off: ${reverseAction} at ₹${currentPrice}`);
      console.log(`   P&L: ₹${(reverseAction === 'SELL' ? currentPrice - order.price : order.price - currentPrice).toFixed(2)} per lot`);
    }

    // Place square-off orders for all users
    console.log("\n\n============================================================");
    console.log("📤 Placing SQUARE-OFF orders for all users...");
    console.log("============================================================\n");

    const IIFLUser = require("../../../../models/IIFLUser");
    const users = await IIFLUser.find({ state: "live" });
    console.log(`✅ Found ${users.length} IIFL users\n`);

    const results = [];

    for (const user of users) {
      console.log(`📊 IIFL Client: ${user.clientName}`);
      console.log(`   💰 Capital: ₹${user.capital?.toLocaleString()}`);
      console.log(`   🔑 Has Token: ${!!user.token}`);

      for (const order of squareOffOrders) {
        console.log(`\n📈 Placing ${order.action} order for 35 lots of ${order.type} Strike ${order.strike} at ₹${order.price}`);

        const orderPayload = [{
          instrumentId: order.security_id,
          exchange: "NSEFO",
          transactionType: order.action,
          quantity: "35",
          orderComplexity: "REGULAR",
          product: "INTRADAY",
          orderType: "LIMIT",
          validity: "DAY",
          price: order.price.toString(),
          apiOrderSource: "BankNiftyStrategy",
          orderTag: `SquareOff_${order.type}_${order.strike}_${Date.now()}`
        }];

        console.log(`📡 IIFL Square-off Order Payload for ${user.clientName}:`);
        console.log(JSON.stringify(orderPayload, null, 2));

        try {
          console.log(`🚀 Sending square-off order to IIFL for ${user.clientName}...`);
          const response = await axios.post(
            "https://api.iiflcapital.com/v1/orders",
            orderPayload,
            {
              headers: {
                Authorization: `Bearer ${user.token}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log(`✅ Square-off order placed successfully for ${user.clientName}`);
          results.push({
            success: true,
            user: user.clientName,
            order: order,
            response: response.data,
          });
        } catch (error) {
          console.error(`❌ Error placing square-off order for ${user.clientName}:`, error.response?.data || error.message);
          results.push({
            success: false,
            user: user.clientName,
            order: order,
            error: error.response?.data || error.message,
          });
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n📊 Square-off Summary: ${successful} successful, ${failed} failed out of ${results.length} total orders`);

    // Update the active trade status to COMPLETED
    try {
      const Trade = require("../../../../models/Trade");
      await Trade.findByIdAndUpdate(activeTrade._id, {
        status: 'COMPLETED',
        updatedAt: new Date()
      });
      console.log(`✅ Previous trade marked as COMPLETED`);
    } catch (error) {
      console.error(`⚠️ Could not update trade status: ${error.message}`);
    }

    return {
      success: true,
      squareOffOrders,
      results
    };

  } catch (error) {
    console.error(`❌ Error squaring off positions: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save trade to database
 */
async function saveTradeToDatabase(signal, orders, results) {
  try {
    // Try to save to MongoDB
    const Trade = require("../../../../models/Trade");

    const trade = new Trade({
      strategy: "BB TRAP BANKNIFTY",
      signal,
      orders,
      results,
      status: "ACTIVE",
    });

    await trade.save();
    console.log(`✅ Trade saved to database with ID: ${trade._id}`);
    return trade;
  } catch (error) {
    console.error(`❌ Error saving trade to database: ${error.message}`);

    // Fallback: Save to JSON file in local data directory
    const tradesFile = path.join(__dirname, "../../data/trades_backup_banknifty.json");
    const tradeData = {
      strategy: "BB TRAP BANKNIFTY",
      signal,
      orders,
      results,
      status: "ACTIVE",
      timestamp: new Date().toISOString(),
    };

    try {
      let trades = [];
      if (fs.existsSync(tradesFile)) {
        const fileContent = fs.readFileSync(tradesFile, "utf-8");
        trades = JSON.parse(fileContent);
      }
      trades.push(tradeData);
      fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
      console.log(`⚠️ Trade saved to backup file: ${tradesFile}`);
      return tradeData;
    } catch (fileError) {
      console.error(`❌ Error saving to backup file: ${fileError.message}`);
      return null;
    }
  }
}

/**
 * Main function to process BB TRAP signal for BankNifty
 */
async function processBBTrapSignal(messageText) {
  try {
    console.log("\n=== BB TRAP SIGNAL PROCESSOR (BANKNIFTY) ===\n");
    console.log(`Received Signal: ${messageText}\n`);

    // Parse the signal
    const signal = parseBBTrapSignal(messageText);

    if (!signal) {
      console.log("❌ Failed to parse BB TRAP signal");
      return {
        success: false,
        error: "Invalid BB TRAP signal format",
      };
    }

    console.log("✅ Signal parsed successfully:");
    console.log(JSON.stringify(signal, null, 2));

    // Check for active trades in opposite direction
    console.log("\n🔍 Checking for active trades...");
    const activeTrades = await getActiveTradesToday(signal.symbol);

    // Read CSV and create security ID map
    console.log("\n1. Reading BankNifty CSV file and mapping security IDs...");
    const securityMap = readSecurityIdMap();

    // Initialize Dhan client
    const dhanClient = new DhanClient();

    // Check if we need to square off existing positions
    let squareOffResult = null;
    if (activeTrades.length > 0) {
      const lastTrade = activeTrades[0];

      // Check if the new signal is opposite to the last active trade
      if (lastTrade.signal.action !== signal.action) {
        console.log("\n⚠️ OPPOSITE SIGNAL DETECTED!");
        console.log(`   Previous: ${lastTrade.signal.action.toUpperCase()} ${lastTrade.signal.symbol}`);
        console.log(`   New: ${signal.action.toUpperCase()} ${signal.symbol}`);
        console.log("\n🔄 Squaring off existing positions before placing new orders...\n");

        squareOffResult = await squareOffPositions(lastTrade, dhanClient, securityMap);

        if (squareOffResult.success) {
          console.log("\n✅ Existing positions squared off successfully!");
        } else {
          console.log("\n⚠️ Square-off had some issues, but continuing with new orders...");
        }
      } else {
        console.log(`\n✅ Same direction signal (${signal.action.toUpperCase()}), no square-off needed`);
      }
    } else {
      console.log("✅ No active trades found, proceeding with new orders");
    }

    // Get expiry list
    console.log("\n2. Fetching expiry list for BankNifty...");
    const expiryList = await dhanClient.getExpiryList(25, "IDX_I"); // BankNifty

    if (!expiryList || !expiryList.data || expiryList.data.length === 0) {
      throw new Error("No expiry dates available for BankNifty");
    }

    console.log(`✅ Available expiries: ${expiryList.data.length}`);
    console.log(`   First expiry: ${expiryList.data[0]}`);

    // Use the first (nearest) expiry
    const expiry = expiryList.data[0];

    // Get option chain
    console.log(`\n3. Fetching option chain for expiry: ${expiry}...`);
    const optionChain = await dhanClient.getOptionChain(25, "IDX_I", expiry);

    if (!optionChain || !optionChain.data) {
      throw new Error("Failed to fetch option chain data for BankNifty");
    }

    console.log(`✅ Option chain fetched`);
    console.log(`   Underlying Last Price: ${optionChain.data?.last_price}`);

    // Log the entire option chain response for debugging
    console.log("\n📊 FULL OPTION CHAIN RESPONSE:");
    console.log(JSON.stringify(optionChain, null, 2));
    console.log("\n");

    // Find strikes with delta closest to 0.50
    console.log(`4. Finding strikes with delta closest to 0.50...`);
    const delta50Strikes = findDelta50Strikes(optionChain, securityMap);

    if (!delta50Strikes.ce || !delta50Strikes.pe) {
      throw new Error("Could not find suitable strikes with delta close to 0.50");
    }

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
      squareOff: squareOffResult,
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
  readSecurityIdMap,
};

