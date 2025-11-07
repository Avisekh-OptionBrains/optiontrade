const express = require("express");

const router = express.Router();
const { EangelparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const MOUser = require("../../../../models/MOUser");

const { handleClientOrder } = require("./MotilalUtils");

router.post("/", async (req, res) => {
  console.log("🏢 MOTILAL OSWAL BROKER - Request received");
  console.log("=".repeat(60));
  console.log("📥 Raw request body:", JSON.stringify(req.body, null, 2));

  let messageText = req.body;

  // Extract messageText if it's wrapped in an object
  if (typeof messageText === "object" && messageText.messageText) {
    messageText = messageText.messageText;
  } else if (typeof messageText === "object") {
    // If it's an object but doesn't have messageText property, convert to string
    messageText = JSON.stringify(messageText);
  }

  // Validate that messageText exists
  if (!messageText || typeof messageText !== "string") {
    console.error("❌ MOTILAL OSWAL BROKER - Invalid messageText received:", messageText);
    return res.status(400).json({ error: "Message text is required and must be a string" });
  }

  console.log("📝 MOTILAL OSWAL BROKER - Processing messageText:", messageText);
  const parsedData = EangelparseMessageText(messageText);

  // Validate parsed data
  if (!parsedData) {
    console.error("❌ MOTILAL OSWAL BROKER - Failed to parse message:", messageText);
    return res.status(400).json({ error: "Invalid message format. Expected format: 'ER Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" });
  }

  console.log("✅ MOTILAL OSWAL BROKER - Message parsed successfully:");
  console.log(JSON.stringify(parsedData, null, 2));
  const { symbol, price, transactionType, stopLoss } = parsedData;

  try {
    // Fetch credentials
    console.log("Fetching credentials...");
    const credentials = await getNetworkCredentials();
    if (
      !credentials.macAddress ||
      !credentials.localIp ||
      !credentials.publicIp
    ) {
      console.error("Missing credentials:", credentials);
      return res.status(400).json({ error: "Missing required credentials" });
    }
    console.log("Credentials fetched successfully");

    // Find the symbol in the database
    console.log("Finding symbol in database:", symbol);
    const document = await findSymbolInDatabase(symbol);
    if (!document) {
      console.error("Symbol not found in database:", symbol);
      return res.status(404).json({ error: `Symbol ${symbol} not found in database` });
    }
    console.log("Symbol found:", document);

    // Fetch all clients from the database
    console.log("Fetching Motilal clients...");
    const clients = await MOUser.find();

    if (!clients || clients.length === 0) {
      console.error("No Motilal clients found in database");
      return res.status(404).json({ error: "No Motilal clients found in database" });
    }

    // Filter clients that have required fields for trading
    const validClients = clients.filter(client => {
      const isValid = client.authToken && client.apiKey && client.capital && client.capital > 0 && client.userId;
      if (!isValid) {
        console.warn(`Client ${client.clientName} is missing required fields or has invalid capital`);
      }
      return isValid;
    });

    if (validClients.length === 0) {
      console.error("No valid Motilal clients found (missing authToken, apiKey, userId, or capital)");
      return res.status(404).json({ error: "No valid Motilal clients found. Clients must have authToken, apiKey, userId, and capital > 0" });
    }

    console.log(`Found ${clients.length} Motilal clients, ${validClients.length} are valid for trading`);

    // Place orders for each valid client asynchronously
    const ordersPromises = validClients.map((client) => {
      console.log(`Processing order for client: ${client.clientName}`);
      return handleClientOrder(
        client,
        document,
        price,
        transactionType,
        credentials,
        stopLoss
      );
    });

    const results = await Promise.allSettled(ordersPromises);

    // Properly categorize results based on business logic
    const successful = results.filter(r => {
      if (r.status === 'fulfilled') {
        // Check if the fulfilled promise actually represents a successful order
        return r.value && r.value.success === true;
      }
      return false;
    }).length;

    const failed = results.filter(r => {
      if (r.status === 'rejected') {
        return true; // Rejected promises are always failures
      }
      if (r.status === 'fulfilled') {
        // Check if the fulfilled promise actually represents a failed order
        return r.value && r.value.success === false;
      }
      return false;
    }).length;

    console.log("📊 MOTILAL OSWAL BROKER - Order processing summary:");
    console.log("=".repeat(60));
    console.log(`✅ Successful orders: ${successful}/${validClients.length}`);
    console.log(`❌ Failed orders: ${failed}/${validClients.length}`);
    console.log(`👥 Total clients processed: ${validClients.length}`);
    console.log(`👥 Total clients in database: ${clients.length}`);

    // Log failed orders with detailed reasons
    if (failed > 0) {
      console.error("❌ MOTILAL OSWAL BROKER - Failed orders details:");
      let failureIndex = 1;

      // Log rejected promises (system failures)
      results.filter(r => r.status === 'rejected').forEach((result) => {
        console.error(`   ${failureIndex}. SYSTEM FAILURE: ${result.reason?.message || result.reason}`);
        failureIndex++;
      });

      // Log fulfilled promises with business logic failures
      results.filter(r => r.status === 'fulfilled' && r.value && r.value.success === false).forEach((result) => {
        console.error(`   ${failureIndex}. BUSINESS LOGIC FAILURE: ${result.value.error}`);
        failureIndex++;
      });
    }

    if (successful > 0) {
      console.log("✅ MOTILAL OSWAL BROKER - Successful orders details:");
      results.filter(r => r.status === 'fulfilled' && r.value && r.value.success === true).forEach((result, index) => {
        console.log(`   ${index + 1}. Order completed successfully`);
        if (result.value && result.value.response) {
          console.log(`      Response: ${JSON.stringify(result.value.response, null, 2)}`);
        }
      });
    }

    const responseData = {
      message: `Orders processed for ${validClients.length} Motilal clients. ${successful} successful, ${failed} failed. ${successful > 0 ? 'Stop-loss orders will be placed shortly.' : 'No stop-loss orders needed.'}`,
      results: {
        total: validClients.length,
        successful,
        failed,
        totalClientsInDB: clients.length,
        validClients: validClients.length,
        details: results.map(r => ({
          status: r.status,
          success: r.status === 'fulfilled' ? (r.value?.success || false) : false,
          error: r.status === 'rejected' ? r.reason : (r.value?.error || null),
          data: r.status === 'fulfilled' ? r.value : null
        }))
      }
    };

    console.log("📤 MOTILAL OSWAL BROKER - Sending response:");
    console.log(JSON.stringify(responseData, null, 2));
    console.log("=".repeat(60));

    res.json(responseData);
  } catch (error) {
    console.error("❌ MOTILAL OSWAL BROKER - Critical error occurred:");
    console.error("=".repeat(60));
    console.error(`🔍 Error Type: ${error.name}`);
    console.error(`📝 Error Message: ${error.message}`);
    console.error(`📚 Error Stack: ${error.stack}`);
    console.error("=".repeat(60));

    const errorResponse = {
      error: "Internal Server Error",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    console.error("📤 MOTILAL OSWAL BROKER - Sending error response:");
    console.error(JSON.stringify(errorResponse, null, 2));

    res.status(500).json(errorResponse);
  }
});

module.exports = router;
