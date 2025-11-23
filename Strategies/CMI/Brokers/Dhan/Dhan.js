const express = require("express");

const router = express.Router();
const { CmiparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const DhanUser = require("../../../../models/DhanUser");
const { dhanHandleClientOrder } = require("../../../../Strategies/Epicrise/Brokers/Dhan/DhanUtils");

router.post("/", async (req, res) => {
  console.log("📈 CMI Dhan broker received request:", req.body);

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
    console.error("❌ CMI Dhan - Invalid messageText received:", messageText);
    return res.status(400).json({ error: "Message text is required and must be a string" });
  }

  console.log("📝 CMI Dhan - Processing messageText:", messageText);
  const parsedData = CmiparseMessageText(messageText);

  // Validate parsed data
  if (!parsedData) {
    console.error("❌ CMI Dhan - Failed to parse message:", messageText);
    return res.status(400).json({ error: "Invalid message format. Expected format: 'CMI Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" });
  }

  console.log("✅ CMI Dhan - Parsed data:", parsedData);
  const { symbol, price, transactionType, stopLoss } = parsedData;

  try {
    // Fetch credentials (network info only)
    console.log("🔑 CMI Dhan - Fetching network credentials...");
    const credentials = await getNetworkCredentials();
    if (!credentials.publicIp || !credentials.localIp || !credentials.macAddress) {
      console.error("❌ CMI Dhan - Missing network credentials:", credentials);
      return res.status(500).json({ error: "Missing Dhan network credentials" });
    }

    console.log("✅ CMI Dhan - Network credentials fetched successfully");

    // Find symbol in database
    console.log(`🔍 CMI Dhan - Looking up symbol: ${symbol}`);
    const symbolData = await findSymbolInDatabase(symbol);
    if (!symbolData) {
      console.error(`❌ CMI Dhan - Symbol not found: ${symbol}`);
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }

    console.log("✅ CMI Dhan - Symbol found:", symbolData);

    // Fetch all clients from the database (same as Epicrise)
    console.log("👥 CMI Dhan - Fetching all users...");
    const clients = await DhanUser.find();
    console.log(`📊 CMI Dhan - Found ${clients.length} total users`);

    if (!clients || clients.length === 0) {
      console.log("⚠️ CMI Dhan - No users found in database");
      return res.status(404).json({ error: "No CMI Dhan users found in database" });
    }

    // Filter clients that have required fields for trading (same as Epicrise)
    const validClients = clients.filter(client => {
      const isValid = client.jwtToken && client.dhanClientId && client.capital && client.capital > 0 && client.state === 'live';
      if (!isValid) {
        console.warn(`CMI Dhan - Client ${client.clientName} is missing required fields or has invalid capital`);
      }
      return isValid;
    });

    console.log(`📊 CMI Dhan - Found ${validClients.length} valid users out of ${clients.length} total`);

    if (validClients.length === 0) {
      console.log("⚠️ CMI Dhan - No valid users found");
      return res.status(200).json({
        message: "No valid CMI Dhan users found",
        processedUsers: 0
      });
    }

    // Process orders for all users in parallel using Promise.allSettled (like Epic Rise)
    console.log(`🚀 CMI Dhan - Processing orders for ${validClients.length} users in parallel`);

    const ordersPromises = validClients.map((user) => {
      console.log(`🔄 CMI Dhan - Queuing order for user: ${user.clientId}`);
      return dhanHandleClientOrder(
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

    console.log(`📊 CMI Dhan - Order processing complete: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error("❌ CMI Dhan - Some orders failed:", results.filter(r => r.status === 'rejected'));
    }

    const successCount = successful;
    const errorCount = failed;

    console.log(`📊 CMI Dhan - Processing complete: ${successCount} successful, ${errorCount} failed`);

    res.status(200).json({
      message: "CMI Dhan orders processed",
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error) {
    console.error("❌ CMI Dhan - Unexpected error:", error);
    res.status(500).json({ 
      error: "Internal server error in CMI Dhan broker",
      details: error.message
    });
  }
});

module.exports = router;
