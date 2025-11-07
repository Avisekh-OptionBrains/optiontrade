const express = require("express");

const router = express.Router();
const { CmiparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const Angeluser = require("../../../../models/Angeluser");
const { angelhandleClientOrder } = require("../../../../Strategies/Epicrise/Brokers/AngelOne/AngelUtils");

router.post("/", async (req, res) => {
  console.log("🔥 CMI Angel broker received request:", req.body);

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
    console.error("❌ CMI Angel - Invalid messageText received:", messageText);
    return res.status(400).json({ error: "Message text is required and must be a string" });
  }

  console.log("📝 CMI Angel - Processing messageText:", messageText);
  const parsedData = CmiparseMessageText(messageText);

  // Validate parsed data
  if (!parsedData) {
    console.error("❌ CMI Angel - Failed to parse message:", messageText);
    return res.status(400).json({ error: "Invalid message format. Expected format: 'CMI Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" });
  }

  console.log("✅ CMI Angel - Parsed data:", parsedData);
  const { symbol, price, transactionType, stopLoss } = parsedData;

  try {
    // Fetch credentials
    console.log("🔑 CMI Angel - Fetching credentials...");
    const credentials = await getNetworkCredentials();
    if (
      !credentials.macAddress ||
      !credentials.localIp ||
      !credentials.publicIp
    ) {
      console.error("❌ CMI Angel - Missing credentials:", credentials);
      return res.status(500).json({ error: "Missing credentials" });
    }

    console.log("✅ CMI Angel - Credentials fetched successfully");

    // Find symbol in database
    console.log(`🔍 CMI Angel - Looking up symbol: ${symbol}`);
    const symbolData = await findSymbolInDatabase(symbol);
    if (!symbolData) {
      console.error(`❌ CMI Angel - Symbol not found: ${symbol}`);
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }

    console.log("✅ CMI Angel - Symbol found:", symbolData);

    // Fetch all clients from the database (same as Epicrise)
    console.log("👥 CMI Angel - Fetching all users...");
    const clients = await Angeluser.find();
    console.log(`📊 CMI Angel - Found ${clients.length} total users`);

    if (!clients || clients.length === 0) {
      console.log("⚠️ CMI Angel - No users found in database");
      return res.status(404).json({ error: "No CMI Angel users found in database" });
    }

    // Filter clients that have required fields for trading (same as Epicrise)
    const validClients = clients.filter(client => {
      const isValid = client.jwtToken && client.apiKey && client.capital && client.capital > 0 && client.userId;
      if (!isValid) {
        console.warn(`CMI Angel - Client ${client.clientName} is missing required fields or has invalid capital`);
      }
      return isValid;
    });

    console.log(`📊 CMI Angel - Found ${validClients.length} valid users out of ${clients.length} total`);

    if (validClients.length === 0) {
      console.log("⚠️ CMI Angel - No valid users found");
      return res.status(200).json({
        message: "No valid CMI Angel users found",
        processedUsers: 0
      });
    }

    // Process orders for all users in parallel (like Epic Rise)
    console.log(`🚀 CMI Angel - Processing orders for ${validClients.length} users in parallel`);

    const ordersPromises = validClients.map((user) => {
      console.log(`🔄 CMI Angel - Queuing order for user: ${user.clientCode}`);
      return angelhandleClientOrder(
        user,
        symbolData,
        price,
        transactionType,
        credentials,
        stopLoss
      );
    });

    const results = await Promise.allSettled(ordersPromises);

    // Convert Promise.allSettled results to our format
    const processedResults = results.map((result, index) => {
      const user = users[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ CMI Angel - Order processed successfully for ${user.clientCode}`);
        return {
          clientCode: user.clientCode,
          status: 'success',
          result: result.value
        };
      } else {
        console.error(`❌ CMI Angel - Error processing order for ${user.clientCode}:`, result.reason.message);
        return {
          clientCode: user.clientCode,
          status: 'error',
          error: result.reason.message
        };
      }
    });

    // Log results like Epic Rise
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 CMI Angel - Order processing complete: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error("❌ CMI Angel - Some orders failed:", results.filter(r => r.status === 'rejected'));
    }

    res.status(200).json({
      message: `CMI Angel orders processed for ${validClients.length} users. ${successful} successful, ${failed} failed.`,
      summary: {
        total: validClients.length,
        successful: successful,
        failed: failed
      },
      results: processedResults
    });

  } catch (error) {
    console.error("❌ CMI Angel - Unexpected error:", error);
    res.status(500).json({ 
      error: "Internal server error in CMI Angel broker",
      details: error.message
    });
  }
});

module.exports = router;
