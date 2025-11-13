const DhanClient = require("./dhanClient");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const IIFLUser = require("../../../../models/IIFLUser");
const { sendMessageToTelegram } = require("../../../Epicrise/Utils/utilities");
const { getSubscribedUsers } = require("../../../../utils/subscriptionManager");

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
 * Entry Signals:
 *   - NEW FORMAT: "BANKNIFTY | Bear Trap | Entry at 51590.5 | SL: 51550.5 | Target: 51650.5"
 *   - NEW FORMAT: "BANKNIFTY | Bull Trap | Entry at 51590.5 | SL: 51630.5 | Target: 51510.5"
 *   - OLD FORMAT: "BB TRAP Buy/Sell SYMBOL at PRICE | SL: PRICE | Target: PRICE"
 *
 * Exit Signals (NEW FORMAT):
 *   - "BB TRAP LONG EXIT (SL HIT) BANKNIFTY at 51550.5"
 *   - "BB TRAP LONG EXIT (TARGET HIT) BANKNIFTY at 51650.5"
 *   - "BB TRAP LONG EXIT (3PM EXIT) BANKNIFTY at 51590.5"
 *   - "BB TRAP SHORT EXIT (SL HIT) BANKNIFTY at 51630.5"
 *   - "BB TRAP SHORT EXIT (TARGET HIT) BANKNIFTY at 51510.5"
 *   - "BB TRAP SHORT EXIT (3PM EXIT) BANKNIFTY at 51590.5"
 *
 * Exit Signals (OLD FORMAT):
 *   - "BB TRAP Exit BANKNIFTY at 51590.5 | Intraday Exit"
 *   - "BB TRAP Exit BANKNIFTY at 51590.5 | End of Day Exit"
 *   - "BB TRAP Exit Sell BANKNIFTY at 51880.5 | SL Hit"
 *   - "BB TRAP Exit Sell BANKNIFTY at 51780.5 | Target Hit"
 */
function parseBBTrapSignal(messageText) {
  // Try to match NEW FORMAT: "<TICKER> | Bear Trap | Entry at <ENTRY> | SL: <SL> | Target: <TARGET>"
  const bearTrapRegex = /(.+?)\s*\|\s*Bear Trap\s*\|\s*Entry at\s*([\d.]+)\s*\|\s*SL:\s*([\d.]+)\s*\|\s*Target:\s*([\d.]+)/i;
  const bearTrapMatch = messageText.match(bearTrapRegex);

  if (bearTrapMatch) {
    return {
      action: 'buy', // Bear Trap = BUY signal
      symbol: bearTrapMatch[1].trim(), // "BANKNIFTY"
      entryPrice: parseFloat(bearTrapMatch[2]),
      stopLoss: parseFloat(bearTrapMatch[3]),
      target: parseFloat(bearTrapMatch[4]),
    };
  }

  // Try to match NEW FORMAT: "<TICKER> | Bull Trap | Entry at <ENTRY> | SL: <SL> | Target: <TARGET>"
  const bullTrapRegex = /(.+?)\s*\|\s*Bull Trap\s*\|\s*Entry at\s*([\d.]+)\s*\|\s*SL:\s*([\d.]+)\s*\|\s*Target:\s*([\d.]+)/i;
  const bullTrapMatch = messageText.match(bullTrapRegex);

  if (bullTrapMatch) {
    return {
      action: 'sell', // Bull Trap = SELL signal
      symbol: bullTrapMatch[1].trim(), // "BANKNIFTY"
      entryPrice: parseFloat(bullTrapMatch[2]),
      stopLoss: parseFloat(bullTrapMatch[3]),
      target: parseFloat(bullTrapMatch[4]),
    };
  }

  // Try to match NEW EXIT FORMAT: "BB TRAP LONG EXIT (SL HIT) <TICKER> at <PRICE>"
  const longExitRegex = /BB TRAP LONG EXIT \((.+?)\)\s+(.+?)\s+at\s+([\d.]+)/i;
  const longExitMatch = messageText.match(longExitRegex);

  if (longExitMatch) {
    const exitReason = longExitMatch[1].trim(); // "SL HIT", "TARGET HIT", or "3PM EXIT"
    return {
      action: 'exit',
      originalDirection: 'buy', // LONG = buy position
      symbol: longExitMatch[2].trim(), // "BANKNIFTY"
      exitPrice: parseFloat(longExitMatch[3]),
      exitType: exitReason, // "SL HIT", "TARGET HIT", or "3PM EXIT"
    };
  }

  // Try to match NEW EXIT FORMAT: "BB TRAP SHORT EXIT (SL HIT) <TICKER> at <PRICE>"
  const shortExitRegex = /BB TRAP SHORT EXIT \((.+?)\)\s+(.+?)\s+at\s+([\d.]+)/i;
  const shortExitMatch = messageText.match(shortExitRegex);

  if (shortExitMatch) {
    const exitReason = shortExitMatch[1].trim(); // "SL HIT", "TARGET HIT", or "3PM EXIT"
    return {
      action: 'exit',
      originalDirection: 'sell', // SHORT = sell position
      symbol: shortExitMatch[2].trim(), // "BANKNIFTY"
      exitPrice: parseFloat(shortExitMatch[3]),
      exitType: exitReason, // "SL HIT", "TARGET HIT", or "3PM EXIT"
    };
  }

  // Try to match OLD EXIT FORMAT with direction (Buy/Sell) - for SL Hit / Target Hit
  const exitWithDirectionRegex = /BB TRAP Exit (Buy|Sell) (.+?) at ([\d.]+) \| (.+)/i;
  const exitWithDirectionMatch = messageText.match(exitWithDirectionRegex);

  if (exitWithDirectionMatch) {
    return {
      action: 'exit',
      originalDirection: exitWithDirectionMatch[1].toLowerCase(), // "buy" or "sell"
      symbol: exitWithDirectionMatch[2].trim(), // "BANKNIFTY"
      exitPrice: parseFloat(exitWithDirectionMatch[3]),
      exitType: exitWithDirectionMatch[4].trim(), // "SL Hit" or "Target Hit"
    };
  }

  // Try to match OLD EXIT FORMAT without direction - for Intraday/End of Day
  const exitRegex = /BB TRAP Exit (.+?) at ([\d.]+) \| (.+)/i;
  const exitMatch = messageText.match(exitRegex);

  if (exitMatch) {
    return {
      action: 'exit',
      symbol: exitMatch[1].trim(), // "BANKNIFTY"
      exitPrice: parseFloat(exitMatch[2]),
      exitType: exitMatch[3].trim(), // "Intraday Exit" or "End of Day Exit"
    };
  }

  // Try to match OLD FORMAT: "BB TRAP Buy/Sell SYMBOL at PRICE | SL: PRICE | Target: PRICE"
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
  const { clientName, token, userID, subscription } = user;

  console.log(`\n📊 IIFL Client: ${clientName}`);
  console.log(`   � User ID: ${userID}`);
  console.log(`   📦 Lot Size: ${subscription.lotSize} lots`);
  console.log(`   📊 Quantity: ${subscription.quantity} qty`);
  console.log(`   🔑 Has Token: ${!!token}`);

  if (!token) {
    console.error(`❌ Missing token for ${clientName}`);
    return { success: false, error: `Missing token for ${clientName}`, clientName };
  }

  if (!subscription || !subscription.quantity) {
    console.error(`❌ Missing subscription or quantity for ${clientName}`);
    return { success: false, error: `Missing subscription data for ${clientName}`, clientName };
  }

  try {
    // Use quantity from subscription (calculated from lot size)
    const quantity = subscription.quantity;

    console.log(`📈 Placing ${order.action} order for ${subscription.lotSize} lots (${quantity} qty) of ${order.type} Strike ${order.strike} at ₹${order.price}`);

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
      price: ceStrike.price, // Changed from top_ask_price to price
      security_id: ceStrike.security_id
    });
    orders.push({
      type: "PE",
      action: "SELL",
      strike: peStrike.strike,
      delta: peStrike.delta,
      price: peStrike.price, // Changed from top_ask_price to price
      security_id: peStrike.security_id
    });
  } else {
    // Sell signal: SELL CE and BUY PE
    orders.push({
      type: "CE",
      action: "SELL",
      strike: ceStrike.strike,
      delta: ceStrike.delta,
      price: ceStrike.price, // Changed from top_ask_price to price
      security_id: ceStrike.security_id
    });
    orders.push({
      type: "PE",
      action: "BUY",
      strike: peStrike.strike,
      delta: peStrike.delta,
      price: peStrike.price, // Changed from top_ask_price to price
      security_id: peStrike.security_id
    });
  }

  console.log(`\n📋 Orders to be placed:`);
  orders.forEach((order, index) => {
    console.log(`${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price} (Security ID: ${order.security_id})`);
  });

  // Get all subscribed users for BankNifty strategy
  console.log(`\n🔍 Fetching subscribed users for BankNifty...`);
  const users = await getSubscribedUsers('BankNifty', signal.symbol);
  console.log(`✅ Found ${users.length} subscribed users`);

  if (users.length === 0) {
    console.log(`⚠️ No users subscribed to BankNifty strategy`);
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
          price: parseFloat((strikeData.ce.top_ask_price || 0).toFixed(2)), // Renamed from top_ask_price to price
          security_id: securityId
        };
        console.log(`   ✅ Found CE: Strike ${closestCE.strike}, Delta ${closestCE.delta}, Price ${closestCE.price}`);
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
          price: parseFloat((strikeData.pe.top_ask_price || 0).toFixed(2)), // Renamed from top_ask_price to price
          security_id: securityId
        };
        console.log(`   ✅ Found PE: Strike ${closestPE.strike}, Delta ${closestPE.delta}, Price ${closestPE.price}`);
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

    // Create formatted message (without "BB TRAP" text)
    let message = `🎯 BANKNIFTY OPTION TRADE\n\n`;
    message += `📊 Signal: ${signal.action.toUpperCase()} ${signal.symbol}\n`;
    message += `💰 Entry: ₹${signal.entryPrice}\n`;
    message += `🛑 Stop Loss: ₹${signal.stopLoss}\n`;
    message += `🎯 Target: ₹${signal.target}\n\n`;

    message += `📋 Option Trades to be Executed:\n`;
    orders.forEach((order, index) => {
      message += `${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price}\n`;
    });

    message += `\n⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

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
 * Get active trades (not limited to today - can square off positions from previous days)
 * Handles symbol variations: "BANKNIFTY" matches "BANKNIFTY1!", etc.
 */
async function getActiveTradesToday(symbol) {
  try {
    const Trade = require("../../../../models/Trade");

    // Normalize symbol: "BANKNIFTY" or "BANKNIFTY1!" both match
    const symbolPattern = symbol.replace(/1!$/, ''); // Remove "1!" if present
    const symbolRegex = new RegExp(`^${symbolPattern}(1!)?$`, 'i');

    // Find ALL active trades for this symbol (not just today's)
    // This allows squaring off positions from previous days
    const activeTrades = await Trade.find({
      'signal.symbol': symbolRegex,
      status: 'ACTIVE'
    }).sort({ createdAt: -1 });

    console.log(`\n📊 Found ${activeTrades.length} active trade(s) for ${symbol}`);

    if (activeTrades.length > 0) {
      console.log(`   Most recent: ${activeTrades[0].signal.action.toUpperCase()} from ${activeTrades[0].createdAt.toLocaleString()}`);
    }

    return activeTrades;
  } catch (error) {
    console.error(`❌ Error fetching active trades: ${error.message}`);

    // Fallback: Check JSON backup file
    try {
      const tradesFile = path.join(__dirname, "../../data/trades_backup_banknifty.json");
      if (fs.existsSync(tradesFile)) {
        const fileContent = fs.readFileSync(tradesFile, "utf-8");
        const trades = JSON.parse(fileContent);

        // Normalize symbol for matching
        const symbolPattern = symbol.replace(/1!$/, '');

        const activeTrades = trades.filter(t => {
          const tradeSymbol = t.signal?.symbol?.replace(/1!$/, '');
          return tradeSymbol === symbolPattern && t.status === 'ACTIVE';
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

    // Place square-off orders for all subscribed users
    console.log("\n\n============================================================");
    console.log("📤 Placing SQUARE-OFF orders for all subscribed users...");
    console.log("============================================================\n");

    // Get users from the original trade results (they have the exact quantities used)
    const originalResults = activeTrade.results || [];
    console.log(`✅ Found ${originalResults.length} original orders to square off\n`);

    // Group results by user to get unique users and their quantities
    const userOrderMap = new Map();
    for (const result of originalResults) {
      if (result.success && result.clientName) {
        if (!userOrderMap.has(result.clientName)) {
          userOrderMap.set(result.clientName, {
            clientName: result.clientName,
            quantity: result.quantity
          });
        }
      }
    }

    // Get current user tokens
    const users = await getSubscribedUsers('BankNifty', activeTrade.signal.symbol);
    const userTokenMap = new Map(users.map(u => [u.clientName, u.token]));

    const results = [];

    for (const user of users) {
      console.log(`📊 IIFL Client: ${user.clientName}`);
      console.log(`   � User ID: ${user.userID}`);
      console.log(`   📦 Lot Size: ${user.subscription.lotSize} lots`);
      console.log(`   📊 Quantity: ${user.subscription.quantity} qty`);
      console.log(`   🔑 Has Token: ${!!user.token}`);

      // Get quantity from original trade results or calculate fallback
      let quantity = user.subscription.quantity;
      if (!quantity) {
        // Fallback: find quantity from original trade results
        const originalUserResult = originalResults.find(r => r.success && r.clientName === user.clientName);
        if (originalUserResult && originalUserResult.quantity) {
          quantity = originalUserResult.quantity;
          console.log(`   ⚠️ Using quantity from original trade: ${quantity} qty`);
        } else if (user.subscription.lotSize) {
          // Last resort: calculate manually
          quantity = user.subscription.lotSize * 35;
          console.log(`   ⚠️ Calculated quantity manually: ${user.subscription.lotSize} × 35 = ${quantity} qty`);
        }
      }

      if (!quantity) {
        console.error(`❌ Cannot determine quantity for ${user.clientName}, skipping`);
        continue;
      }

      for (const order of squareOffOrders) {
        console.log(`\n📈 Placing ${order.action} order for ${quantity} qty of ${order.type} Strike ${order.strike} at ₹${order.price}`);

        const orderPayload = [{
          instrumentId: order.security_id,
          exchange: "NSEFO",
          transactionType: order.action,
          quantity: quantity.toString(),
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

    // Trade is ACTIVE if strategy calculated successfully
    // Even if broker execution failed, the trade is still tracked
    const trade = new Trade({
      strategy: "BB TRAP", // Must match enum in Trade model
      signal,
      orders,
      results,
      status: "ACTIVE", // Always ACTIVE - strategy calculated the trade
    });

    await trade.save();
    console.log(`✅ Trade saved to database with ID: ${trade._id}`);
    console.log(`   Status: ACTIVE (strategy-based, independent of broker execution)`);
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
      status: "ACTIVE", // Always ACTIVE
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

      // Read CSV and create security ID map
      console.log("\n1. Reading BankNifty CSV file and mapping security IDs...");
      const securityMap = readSecurityIdMap();

      // Initialize Dhan client
      const dhanClient = new DhanClient();

      // Square off all active trades
      console.log(`\n📊 Found ${activeTrades.length} active trade(s) to exit\n`);

      const squareOffResult = await squareOffPositions(activeTrades[0], dhanClient, securityMap);

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
          console.log("   Now proceeding with new orders...\n");
        } else {
          console.log("\n⚠️ Square-off had some issues, but continuing with new orders...");
        }
      } else {
        // Same direction signal - Pine Script prevents duplicates, so this shouldn't happen
        // But if it does, we'll just log it and continue (might be a manual test)
        console.log(`\n⚠️ SAME DIRECTION SIGNAL DETECTED!`);
        console.log(`   Already in ${signal.action.toUpperCase()} position`);
        console.log(`   ⚙️ Pine Script should prevent this - might be manual test`);
        console.log(`   Proceeding anyway...\n`);
      }
    } else {
      console.log("✅ No active trades found, proceeding with new orders");
    }

    // STRATEGY EXECUTION (Independent of broker)
    let orders = [];
    let results = [];
    let delta50Strikes = null;

    try {
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

      // Find strikes with delta closest to 0.50
      console.log(`\n4. Finding strikes with delta closest to 0.50...`);
      delta50Strikes = findDelta50Strikes(optionChain, securityMap);

      if (!delta50Strikes.ce || !delta50Strikes.pe) {
        throw new Error("Could not find suitable strikes with delta close to 0.50");
      }

      // Create order objects based on strategy
      if (signal.action === "buy") {
        orders = [
          {
            type: "CE",
            action: "BUY",
            strike: delta50Strikes.ce.strike,
            delta: delta50Strikes.ce.delta,
            price: delta50Strikes.ce.price,
            security_id: delta50Strikes.ce.security_id,
          },
          {
            type: "PE",
            action: "SELL",
            strike: delta50Strikes.pe.strike,
            delta: delta50Strikes.pe.delta,
            price: delta50Strikes.pe.price,
            security_id: delta50Strikes.pe.security_id,
          },
        ];
      } else {
        orders = [
          {
            type: "CE",
            action: "SELL",
            strike: delta50Strikes.ce.strike,
            delta: delta50Strikes.ce.delta,
            price: delta50Strikes.ce.price,
            security_id: delta50Strikes.ce.security_id,
          },
          {
            type: "PE",
            action: "BUY",
            strike: delta50Strikes.pe.strike,
            delta: delta50Strikes.pe.delta,
            price: delta50Strikes.pe.price,
            security_id: delta50Strikes.pe.security_id,
          },
        ];
      }

      console.log("\n✅ STRATEGY CALCULATED SUCCESSFULLY!");
      console.log(`   Orders to execute: ${orders.length}`);

    } catch (error) {
      console.error("\n❌ STRATEGY CALCULATION FAILED!");
      console.error(`   Error: ${error.message}`);

      // Strategy failed - cannot proceed
      return {
        success: false,
        error: `Strategy calculation failed: ${error.message}`,
        signal,
        squareOff: squareOffResult,
      };
    }

    // BROKER EXECUTION (Best effort - failures are OK)
    console.log("\n5. Attempting broker execution via IIFL...");
    try {
      const executionResult = await placeOptionOrders(signal, delta50Strikes.ce, delta50Strikes.pe);
      results = executionResult.results;

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        console.log(`✅ Broker execution: ${successCount} successful, ${failCount} failed`);
      } else {
        console.log(`⚠️ Broker execution: All orders failed (but trade is still recorded)`);
      }
    } catch (error) {
      console.error(`⚠️ Broker execution failed: ${error.message}`);
      console.log(`   Trade will still be saved with calculated prices`);

      // Create failed results for each order
      results = orders.map(order => ({
        success: false,
        order: order,
        error: `Broker execution failed: ${error.message}`,
      }));
    }

    // Send Telegram notification (always, even if broker failed)
    console.log("\n6. Sending Telegram notification...");
    const telegramResult = await sendTelegramNotification(signal, orders, results);
    if (telegramResult.success) {
      console.log(`✅ Telegram notification sent (Message ID: ${telegramResult.messageId})`);
    } else {
      console.log(`⚠️ Telegram notification failed: ${telegramResult.error}`);
    }

    // Save trade to database (always, even if broker failed)
    console.log("\n7. Saving trade to database...");
    const savedTrade = await saveTradeToDatabase(signal, orders, results);

    console.log("\n=== PROCESSING COMPLETE ===");
    console.log(`✅ Strategy: Calculated`);
    console.log(`${results.some(r => r.success) ? '✅' : '⚠️'} Broker: ${results.filter(r => r.success).length}/${results.length} orders executed`);
    console.log(`✅ Database: Trade saved`);
    console.log(`${telegramResult.success ? '✅' : '⚠️'} Telegram: ${telegramResult.success ? 'Sent' : 'Failed'}`);

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

