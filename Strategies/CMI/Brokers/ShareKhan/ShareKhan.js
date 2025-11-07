const express = require("express");

const router = express.Router();
const { CmiparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const ShareKhanUser = require("../../../../models/ShareKhanUser");
const { shareKhanHandleClientOrder } = require("../../../../Strategies/Epicrise/Brokers/ShareKhan/ShareKhanUtils");

router.post("/", async (req, res) => {
  console.log("🏦 CMI ShareKhan broker received request:", req.body);

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
    console.error("❌ CMI ShareKhan - Invalid messageText received:", messageText);
    return res.status(400).json({ error: "Message text is required and must be a string" });
  }

  console.log("📝 CMI ShareKhan - Processing messageText:", messageText);
  const parsedData = CmiparseMessageText(messageText);

  // Validate parsed data
  if (!parsedData) {
    console.error("❌ CMI ShareKhan - Failed to parse message:", messageText);
    return res.status(400).json({ error: "Invalid message format. Expected format: 'CMI Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" });
  }

  console.log("✅ CMI ShareKhan - Parsed data:", parsedData);
  const { symbol, price, transactionType, stopLoss } = parsedData;

  try {
    // Fetch credentials (network info only)
    console.log("🔑 CMI ShareKhan - Fetching network credentials...");
    const credentials = await getNetworkCredentials();
    if (!credentials.publicIp || !credentials.localIp || !credentials.macAddress) {
      console.error("❌ CMI ShareKhan - Missing network credentials:", credentials);
      return res.status(500).json({ error: "Missing ShareKhan network credentials" });
    }

    console.log("✅ CMI ShareKhan - Network credentials fetched successfully");

    // Find symbol in database
    console.log(`🔍 CMI ShareKhan - Looking up symbol: ${symbol}`);
    const symbolData = await findSymbolInDatabase(symbol);
    if (!symbolData) {
      console.error(`❌ CMI ShareKhan - Symbol not found: ${symbol}`);
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }

    console.log("✅ CMI ShareKhan - Symbol found:", symbolData);

    // Fetch all clients from the database (same as Epicrise)
    console.log("👥 CMI ShareKhan - Fetching all users...");
    const clients = await ShareKhanUser.find();
    console.log(`📊 CMI ShareKhan - Found ${clients.length} total users`);

    if (!clients || clients.length === 0) {
      console.log("⚠️ CMI ShareKhan - No users found in database");
      return res.status(404).json({ error: "No CMI ShareKhan users found in database" });
    }

    // Filter clients that have required fields for trading (same as Epicrise)
    const validClients = clients.filter(client => {
      const isValid = client.accessToken && client.apiKey && client.capital && client.capital > 0;
      if (!isValid) {
        console.warn(`CMI ShareKhan - Client ${client.clientName} is missing required fields or has invalid capital`);
      }
      return isValid;
    });

    console.log(`📊 CMI ShareKhan - Found ${validClients.length} valid users out of ${clients.length} total`);

    if (validClients.length === 0) {
      console.log("⚠️ CMI ShareKhan - No valid users found");
      return res.status(200).json({
        message: "No valid CMI ShareKhan users found",
        processedUsers: 0
      });
    }

    // Process orders for all users in parallel using Promise.allSettled (like Epic Rise)
    console.log(`🚀 CMI ShareKhan - Processing orders for ${validClients.length} users in parallel`);

    const ordersPromises = validClients.map((user) => {
      console.log(`🔄 CMI ShareKhan - Queuing order for user: ${user.userId}`);
      return shareKhanHandleClientOrder(
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

    console.log(`📊 CMI ShareKhan - Order processing complete: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error("❌ CMI ShareKhan - Some orders failed:", results.filter(r => r.status === 'rejected'));
    }

    const successCount = successful;
    const errorCount = failed;

    console.log(`📊 CMI ShareKhan - Processing complete: ${successCount} successful, ${errorCount} failed`);

    res.status(200).json({
      message: "CMI ShareKhan orders processed",
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error) {
    console.error("❌ CMI ShareKhan - Unexpected error:", error);
    res.status(500).json({ 
      error: "Internal server error in CMI ShareKhan broker",
      details: error.message
    });
  }
});

module.exports = router;
