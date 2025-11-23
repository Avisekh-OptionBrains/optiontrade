const express = require("express");

const router = express.Router();
const { EangelparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const DhanUser = require("../../../../models/DhanUser");
const { dhanHandleClientOrder } = require("./DhanUtils");

router.post("/", async (req, res) => {
  console.log("=".repeat(80));
  console.log("🔵 DHAN BROKER - REQUEST RECEIVED");
  console.log("=".repeat(80));
  console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));
  console.log("⏰ Timestamp:", new Date().toISOString());

  let messageText = req.body;

  // Extract messageText if it's wrapped in an object
  if (typeof messageText === "object" && messageText.messageText) {
    console.log("📝 Extracting messageText from object wrapper");
    messageText = messageText.messageText;
  } else if (typeof messageText === "object") {
    console.log("📝 Converting object to string");
    messageText = JSON.stringify(messageText);
  }

  console.log("📝 Final messageText:", messageText);

  // Validate that messageText exists
  if (!messageText || typeof messageText !== "string") {
    console.error("❌ VALIDATION ERROR: Invalid messageText received:", messageText);
    console.log("=".repeat(80));
    return res.status(400).json({
      error: "Message text is required and must be a string",
      received: messageText,
      type: typeof messageText
    });
  }

  try {
    console.log("🔄 PROCESSING MESSAGE FOR DHAN BROKER");
    console.log("📝 Raw message:", messageText);

    // Parse the message text to extract trading information
    console.log("🔍 Parsing message text...");
    const parsedMessage = EangelparseMessageText(messageText);
    console.log("✅ Parsed message result:", JSON.stringify(parsedMessage, null, 2));

    if (!parsedMessage || !parsedMessage.symbol) {
      console.error("❌ PARSING ERROR: Failed to parse message or missing symbol");
      console.error("📊 Parsed result:", parsedMessage);
      console.log("=".repeat(80));
      return res.status(400).json({
        error: "Invalid message format or missing symbol",
        parsedMessage: parsedMessage,
        originalMessage: messageText
      });
    }

    const { symbol, price, transactionType, stopLoss } = parsedMessage;
    console.log("📊 Extracted trading data:");
    console.log(`   🎯 Symbol: ${symbol}`);
    console.log(`   💰 Price: ${price}`);
    console.log(`   📈 Transaction Type: ${transactionType}`);
    console.log(`   🛡️ Stop Loss: ${stopLoss}`);

    // Find the symbol in the database
    console.log("🔍 Searching for symbol in database...");
    const document = await findSymbolInDatabase(symbol);
    if (!document) {
      console.error(`❌ DATABASE ERROR: Symbol ${symbol} not found in database`);
      console.log("=".repeat(80));
      return res.status(404).json({
        error: `Symbol ${symbol} not found in database`,
        symbol: symbol,
        searchedAt: new Date().toISOString()
      });
    }

    console.log("✅ Symbol found in database:");
    console.log(`   📊 Symbol: ${document.symbol}`);
    console.log(`   🔢 Token: ${document.token}`);
    console.log(`   📝 Name: ${document.name}`);

    // Get credentials for API calls
    console.log("🔑 Retrieving credentials for Dhan API calls...");
    const credentials = await getNetworkCredentials();
    console.log("✅ Credentials retrieved successfully:");
    console.log(`   🌐 Public IP: ${credentials.publicIp}`);
    console.log(`   🏠 Local IP: ${credentials.localIp}`);
    console.log(`   🔧 MAC Address: ${credentials.macAddress}`);

    // Fetch all Dhan clients from the database
    console.log("👥 Fetching Dhan clients from database...");
    const clients = await DhanUser.find();
    console.log(`📊 Found ${clients.length} Dhan clients in database`);

    if (clients.length === 0) {
      console.error("❌ NO CLIENTS: No Dhan clients found in database");
      console.log("=".repeat(80));
      return res.status(404).json({
        error: "No Dhan clients found in database",
        clientCount: 0,
        searchedAt: new Date().toISOString()
      });
    }

    // Log client details (without sensitive info)
    console.log("👥 Client Details:");
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.clientName} (${client.email})`);
      console.log(`      📧 Email: ${client.email}`);
      console.log(`      📱 Phone: ${client.phoneNumber}`);
      console.log(`      🆔 Client ID: ${client.dhanClientId}`);
      console.log(`      💰 Capital: ₹${client.capital}`);
      console.log(`      🔄 State: ${client.state}`);
      console.log(`      🔑 Has JWT: ${!!client.jwtToken}`);
    });

    // Filter valid clients (must have jwtToken, dhanClientId, and capital > 0)
    console.log("🔍 Validating clients for trading...");
    const validClients = clients.filter(client => {
      const isValid = client.jwtToken &&
                     client.dhanClientId &&
                     client.capital &&
                     client.capital > 0 &&
                     client.state === 'live';

      if (!isValid) {
        console.warn(`⚠️  Client ${client.clientName} is INVALID:`, {
          hasJwtToken: !!client.jwtToken,
          hasDhanClientId: !!client.dhanClientId,
          hasCapital: !!client.capital,
          capitalValue: client.capital,
          state: client.state
        });
      } else {
        console.log(`✅ Client ${client.clientName} is VALID for trading`);
      }

      return isValid;
    });

    if (validClients.length === 0) {
      console.error("❌ NO VALID CLIENTS: No valid Dhan clients found");
      console.error("📋 Requirements: jwtToken, dhanClientId, capital > 0, state = 'live'");
      console.log("=".repeat(80));
      return res.status(404).json({
        error: "No valid Dhan clients found. Clients must have jwtToken, dhanClientId, capital > 0, and be in live state",
        totalClients: clients.length,
        validClients: 0,
        requirements: ["jwtToken", "dhanClientId", "capital > 0", "state = 'live'"]
      });
    }

    console.log(`📊 CLIENT SUMMARY: ${clients.length} total clients, ${validClients.length} valid for trading`);
    console.log("✅ Valid clients:");
    validClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.clientName} - ₹${client.capital}`);
    });

    // Place orders for each valid client asynchronously
    console.log("🚀 STARTING ORDER PLACEMENT FOR ALL VALID CLIENTS");
    console.log("=".repeat(50));

    const ordersPromises = validClients.map((client, index) => {
      console.log(`📤 [${index + 1}/${validClients.length}] Processing order for client: ${client.clientName}`);
      return dhanHandleClientOrder(
        client,
        document,
        price,
        transactionType,
        credentials,
        stopLoss
      );
    });

    console.log("⏳ Waiting for all orders to complete...");
    const orderResults = await Promise.allSettled(ordersPromises);

    console.log("=".repeat(50));
    console.log("📊 ORDER PROCESSING RESULTS");
    console.log("=".repeat(50));

    // Log results
    const successfulOrders = orderResults.filter(result => result.status === 'fulfilled' && result.value.success);
    const failedOrders = orderResults.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success));

    console.log(`✅ Successful orders: ${successfulOrders.length}`);
    console.log(`❌ Failed orders: ${failedOrders.length}`);
    console.log(`📊 Total processed: ${orderResults.length}`);

    // Log successful orders
    successfulOrders.forEach((result, index) => {
      const clientIndex = orderResults.findIndex(r => r === result);
      const client = validClients[clientIndex];
      console.log(`✅ SUCCESS: ${client?.clientName} - Order placed successfully`);
      if (result.value.response) {
        console.log(`   📋 Order ID: ${result.value.response.orderId}`);
        console.log(`   📊 Status: ${result.value.response.orderStatus}`);
      }
    });

    // Log failed orders for debugging
    failedOrders.forEach((result, index) => {
      const clientIndex = orderResults.findIndex(r => r === result);
      const client = validClients[clientIndex];

      if (result.status === 'rejected') {
        console.error(`❌ REJECTED: ${client?.clientName} - Order rejected`);
        console.error(`   🔍 Reason: ${result.reason?.message || result.reason}`);
      } else if (result.status === 'fulfilled' && !result.value.success) {
        console.error(`❌ FAILED: ${client?.clientName} - Order failed`);
        console.error(`   🔍 Error: ${result.value.error}`);
      }
    });

    const responseData = {
      message: "Dhan broker request processed successfully",
      broker: "DHAN",
      timestamp: new Date().toISOString(),
      trading: {
        symbol: symbol,
        transactionType: transactionType,
        price: price,
        stopLoss: stopLoss
      },
      clients: {
        total: clients.length,
        valid: validClients.length,
        invalid: clients.length - validClients.length
      },
      orders: {
        successful: successfulOrders.length,
        failed: failedOrders.length,
        total: orderResults.length
      },
      successRate: `${((successfulOrders.length / orderResults.length) * 100).toFixed(1)}%`
    };

    console.log("=".repeat(80));
    console.log("📤 SENDING RESPONSE TO CLIENT");
    console.log("=".repeat(80));
    console.log("📊 Response Summary:", JSON.stringify(responseData, null, 2));
    console.log("=".repeat(80));

    res.status(200).json(responseData);

  } catch (error) {
    console.log("=".repeat(80));
    console.error("💥 CRITICAL ERROR IN DHAN BROKER");
    console.log("=".repeat(80));
    console.error("❌ Error Type:", error.constructor.name);
    console.error("❌ Error Message:", error.message);
    console.error("❌ Error Stack:", error.stack);
    console.error("⏰ Error Timestamp:", new Date().toISOString());
    console.log("=".repeat(80));

    const errorResponse = {
      error: "Internal Server Error",
      broker: "DHAN",
      details: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    console.log("📤 Sending error response:", JSON.stringify(errorResponse, null, 2));
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
