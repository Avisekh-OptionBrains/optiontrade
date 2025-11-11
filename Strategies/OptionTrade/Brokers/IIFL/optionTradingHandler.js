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
  // Use local data folder - path from Brokers/IIFL/ to OptionTrade/data/
  // __dirname = .../Strategies/OptionTrade/Brokers/IIFL
  // ../../data = .../Strategies/OptionTrade/data
  const csvPath = path.join(__dirname, "../../data/data.csv");

  console.log(`📂 Reading NIFTY CSV file from local data folder...`);
  console.log(`   Path: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ NIFTY CSV file not found at: ${csvPath}`);
    throw new Error(`NIFTY CSV file not found at: ${csvPath}`);
  }

  console.log(`✅ CSV file found!`);
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
 * Examples:
 *   - "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"
 *   - "BB TRAP Exit NIFTY at 19820.5 | Intraday Exit"
 *   - "BB TRAP Exit NIFTY at 19820.5 | End of Day Exit"
 *   - "BB TRAP Exit Sell NIFTY at 19880.5 | SL Hit"
 *   - "BB TRAP Exit Sell NIFTY at 19780.5 | Target Hit"
 */
function parseBBTrapSignal(signalText) {
  // Try to match Exit signal with direction (Buy/Sell) - for SL Hit / Target Hit
  const exitWithDirectionRegex = /BB TRAP Exit (Buy|Sell) (.+?) at ([\d.]+) \| (.+)/i;
  const exitWithDirectionMatch = signalText.match(exitWithDirectionRegex);

  if (exitWithDirectionMatch) {
    return {
      action: 'exit',
      originalDirection: exitWithDirectionMatch[1].toLowerCase(), // "buy" or "sell"
      symbol: exitWithDirectionMatch[2].trim(), // "NIFTY" or "NIFTY1!"
      exitPrice: parseFloat(exitWithDirectionMatch[3]),
      exitType: exitWithDirectionMatch[4].trim(), // "SL Hit" or "Target Hit"
    };
  }

  // Try to match Exit signal without direction - for Intraday/End of Day
  const exitRegex = /BB TRAP Exit (.+?) at ([\d.]+) \| (.+)/i;
  const exitMatch = signalText.match(exitRegex);

  if (exitMatch) {
    return {
      action: 'exit',
      symbol: exitMatch[1].trim(), // "NIFTY" or "NIFTY1!"
      exitPrice: parseFloat(exitMatch[2]),
      exitType: exitMatch[3].trim(), // "Intraday Exit" or "End of Day Exit"
    };
  }

  // Try to match Buy/Sell signal
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
 * Get active trades for today
 * Handles symbol variations: "NIFTY" matches "NIFTY1!", etc.
 */
async function getActiveTradesToday(symbol) {
  try {
    const Trade = require("../../../../models/Trade");

    // Get start of today (IST)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Normalize symbol: "NIFTY" or "NIFTY1!" both match
    const symbolPattern = symbol.replace(/1!$/, ''); // Remove "1!" if present
    const symbolRegex = new RegExp(`^${symbolPattern}(1!)?$`, 'i');

    const activeTrades = await Trade.find({
      'signal.symbol': symbolRegex,
      status: 'ACTIVE',
      createdAt: { $gte: todayStart }
    }).sort({ createdAt: -1 });

    console.log(`\n📊 Found ${activeTrades.length} active trade(s) for ${symbol} today`);
    return activeTrades;
  } catch (error) {
    console.error(`❌ Error fetching active trades: ${error.message}`);

    // Fallback: Check JSON backup file
    try {
      const tradesFile = path.join(__dirname, "../../data/trades_backup.json");
      if (fs.existsSync(tradesFile)) {
        const content = fs.readFileSync(tradesFile, "utf-8");
        const trades = JSON.parse(content);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Normalize symbol for matching
        const symbolPattern = symbol.replace(/1!$/, '');

        const activeTrades = trades.filter(t => {
          const tradeSymbol = t.signal?.symbol?.replace(/1!$/, '');
          return tradeSymbol === symbolPattern &&
            t.status === 'ACTIVE' &&
            new Date(t.timestamp) >= todayStart;
        });

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
    const expiryList = await dhanClient.getExpiryList(13, "IDX_I"); // NIFTY
    const nearestExpiry = expiryList.data[0];
    const optionChainData = await dhanClient.getOptionChain(13, "IDX_I", nearestExpiry);

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
        console.log(`\n📈 Placing ${order.action} order for 75 lots of ${order.type} Strike ${order.strike} at ₹${order.price}`);

        const orderPayload = [{
          instrumentId: order.security_id,
          exchange: "NSEFO",
          transactionType: order.action,
          quantity: "75",
          orderComplexity: "REGULAR",
          product: "INTRADAY",
          orderType: "LIMIT",
          validity: "DAY",
          price: order.price.toString(),
          apiOrderSource: "OptionTradeStrategy",
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
 * Save trade to database or JSON file
 */
async function saveTradeToDatabase(signal, orders, results) {
  try {
    // Try to save to MongoDB
    const Trade = require("../../../../models/Trade");

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

    // Fallback: Save to JSON file in local data directory
    const tradesFile = path.join(__dirname, "../../data/trades_backup.json");

    try {
      let trades = [];

      if (fs.existsSync(tradesFile)) {
        const content = fs.readFileSync(tradesFile, "utf-8");
        trades = JSON.parse(content);
      }

      trades.push({
        timestamp: new Date().toISOString(),
        strategy: "BB TRAP NIFTY",
        signal,
        orders,
        results,
      });

      fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
      console.log(`⚠️ Trade saved to backup file: ${tradesFile}`);
    } catch (fileError) {
      console.error(`❌ Failed to save backup file: ${fileError.message}`);
    }

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

    // Handle EXIT signals
    if (signal.action === 'exit') {
      console.log("\n🚪 EXIT SIGNAL DETECTED!");
      console.log(`   Exit Type: ${signal.exitType}`);
      console.log(`   Exit Price: ₹${signal.exitPrice}`);
      if (signal.originalDirection) {
        console.log(`   Original Direction: ${signal.originalDirection.toUpperCase()}`);
      }

      // Check for active trades
      console.log("\n🔍 Checking for active trades...");
      const activeTrades = await getActiveTradesToday(signal.symbol);

      if (activeTrades.length === 0) {
        console.log("⚠️ No active trades found to exit");
        return {
          success: false,
          error: "No active trades found to exit",
          message: "No active positions to square off"
        };
      }

      // Initialize Dhan Client
      const dhanClient = new DhanClient();

      // Read CSV and create security ID map
      console.log("\n1. Reading CSV file and mapping security IDs...");
      const securityIdMap = readSecurityIdMap();
      console.log(`✅ Security ID map created with ${Object.keys(securityIdMap).length} entries\n`);

      // Square off all active trades
      console.log(`\n📊 Found ${activeTrades.length} active trade(s) to exit\n`);

      const squareOffResult = await squareOffPositions(activeTrades[0], dhanClient, securityIdMap);

      if (squareOffResult.success) {
        console.log("\n✅ EXIT COMPLETED SUCCESSFULLY!");
        return {
          success: true,
          message: `${signal.exitType} completed successfully`,
          squareOffResult
        };
      } else {
        console.log("\n❌ EXIT FAILED!");
        return {
          success: false,
          error: "Failed to square off positions",
          squareOffResult
        };
      }
    }

    // Check for active trades in opposite direction
    console.log("\n🔍 Checking for active trades...");
    const activeTrades = await getActiveTradesToday(signal.symbol);

    // Initialize Dhan Client
    const dhanClient = new DhanClient();

    // Read CSV and create security ID map
    console.log("\n1. Reading CSV file and mapping security IDs...");
    const securityIdMap = readSecurityIdMap();
    console.log(`✅ Security ID map created with ${Object.keys(securityIdMap).length} entries\n`);

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

        squareOffResult = await squareOffPositions(lastTrade, dhanClient, securityIdMap);

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
  saveTradeToDatabase,
  readSecurityIdMap,
};

