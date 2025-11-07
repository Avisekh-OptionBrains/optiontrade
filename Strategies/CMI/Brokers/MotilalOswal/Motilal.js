const express = require("express");

const router = express.Router();
const { CmiparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const MOUser = require("../../../../models/MOUser");

const { handleClientOrder } = require("../../../../Strategies/Epicrise/Brokers/MotilalOswal/MotilalUtils");

router.post("/", async (req, res) => {
  console.log("🏢 CMI MOTILAL OSWAL BROKER - Request received");
  console.log("=" * 60);
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
    console.error("❌ CMI MOTILAL OSWAL BROKER - Invalid messageText received:", messageText);
    return res.status(400).json({ error: "Message text is required and must be a string" });
  }

  console.log("📝 CMI MOTILAL OSWAL BROKER - Processing messageText:", messageText);
  const parsedData = CmiparseMessageText(messageText);

  // Validate parsed data
  if (!parsedData) {
    console.error("❌ CMI MOTILAL OSWAL BROKER - Failed to parse message:", messageText);
    return res.status(400).json({ error: "Invalid message format. Expected format: 'CMI Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" });
  }

  console.log("✅ CMI MOTILAL OSWAL BROKER - Message parsed successfully:");
  console.log(JSON.stringify(parsedData, null, 2));
  const { symbol, price, transactionType, stopLoss } = parsedData;

  try {
    // Fetch credentials (network info only)
    console.log("Fetching network credentials...");
    const credentials = await getNetworkCredentials();
    if (
      !credentials.macAddress ||
      !credentials.localIp ||
      !credentials.publicIp
    ) {
      console.error("❌ CMI MOTILAL OSWAL BROKER - Missing network credentials:", credentials);
      return res.status(500).json({ error: "Missing network credentials" });
    }

    console.log("✅ CMI MOTILAL OSWAL BROKER - Network credentials fetched successfully");

    // Find symbol in database
    console.log(`🔍 CMI MOTILAL OSWAL BROKER - Looking up symbol: ${symbol}`);
    const symbolData = await findSymbolInDatabase(symbol);
    if (!symbolData) {
      console.error(`❌ CMI MOTILAL OSWAL BROKER - Symbol not found: ${symbol}`);
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }

    console.log("✅ CMI MOTILAL OSWAL BROKER - Symbol found:", symbolData);

    // Fetch all clients from the database (same as Epicrise)
    console.log("👥 CMI MOTILAL OSWAL BROKER - Fetching all users...");
    const clients = await MOUser.find();
    console.log(`📊 CMI MOTILAL OSWAL BROKER - Found ${clients.length} total users`);

    if (!clients || clients.length === 0) {
      console.log("⚠️ CMI MOTILAL OSWAL BROKER - No users found in database");
      return res.status(404).json({ error: "No CMI Motilal Oswal users found in database" });
    }

    // Filter clients that have required fields for trading (same as Epicrise)
    const validClients = clients.filter(client => {
      const isValid = client.authToken && client.apiKey && client.capital && client.capital > 0 && client.userId;
      if (!isValid) {
        console.warn(`CMI MOTILAL - Client ${client.clientName} is missing required fields or has invalid capital`);
      }
      return isValid;
    });

    console.log(`📊 CMI MOTILAL OSWAL BROKER - Found ${validClients.length} valid users out of ${clients.length} total`);

    if (validClients.length === 0) {
      console.log("⚠️ CMI MOTILAL OSWAL BROKER - No valid users found");
      return res.status(200).json({
        message: "No valid CMI Motilal Oswal users found",
        processedUsers: 0
      });
    }

    // Process orders for all users in parallel using Promise.allSettled (like Epic Rise)
    console.log(`🚀 CMI MOTILAL OSWAL - Processing orders for ${validClients.length} users in parallel`);

    const ordersPromises = validClients.map((user) => {
      console.log(`🔄 CMI MOTILAL OSWAL - Queuing order for user: ${user.clientCode}`);
      return handleClientOrder(
        user,
        symbolData,
        price,
        transactionType,
        credentials,
        stopLoss
      );
    });

    const results = await Promise.allSettled(ordersPromises);

    // Log results like Epic Rise
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 CMI MOTILAL OSWAL - Order processing complete: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error("❌ CMI MOTILAL OSWAL - Some orders failed:", results.filter(r => r.status === 'rejected'));
    }

    const successCount = successful;
    const errorCount = failed;

    console.log(`📊 CMI MOTILAL OSWAL BROKER - Processing complete: ${successCount} successful, ${errorCount} failed`);

    res.status(200).json({
      message: "CMI Motilal Oswal orders processed",
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error) {
    console.error("❌ CMI MOTILAL OSWAL BROKER - Unexpected error:", error);
    res.status(500).json({ 
      error: "Internal server error in CMI Motilal Oswal broker",
      details: error.message
    });
  }
});

module.exports = router;
