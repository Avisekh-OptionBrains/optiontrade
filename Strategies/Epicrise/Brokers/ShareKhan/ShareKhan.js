const express = require("express");

const router = express.Router();
const { EangelparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const ShareKhanUser = require("../../../../models/ShareKhanUser");
const { shareKhanHandleClientOrder } = require("./ShareKhanUtils");

router.post("/", async (req, res) => {
  try {
    console.log("🟢".repeat(50));
    console.log("🚀 SHAREKHAN BROKER ENDPOINT HIT");
    console.log("🟢".repeat(50));
    console.log("📥 Full Request Body:", JSON.stringify(req.body, null, 2));

    // Use the same approach as Motilal - handle webhook data consistently
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
      console.error("Invalid messageText received:", messageText);
      return res.status(400).json({ error: "Message text is required and must be a string" });
    }

    console.log("Processing messageText:", messageText);
    const parsedData = EangelparseMessageText(messageText);
    
    if (!parsedData) {
      console.error("❌ Failed to parse message");
      return res.status(400).json({ error: "Failed to parse message" });
    }

    console.log("✅ Parsed trading data:");
    console.log(JSON.stringify(parsedData, null, 2));

    const { symbol, transactionType, price, stopLoss } = parsedData;

    if (!symbol || !transactionType || !price) {
      console.error("❌ Missing required trading parameters");
      return res.status(400).json({
        error: "Missing required parameters: symbol, transactionType, or price"
      });
    }

    // Find symbol in database
    console.log(`🔍 Searching for symbol: ${symbol}`);
    const document = await findSymbolInDatabase(symbol);
    
    if (!document) {
      console.error(`❌ Symbol ${symbol} not found in database`);
      return res.status(404).json({ error: `Symbol ${symbol} not found in database` });
    }

    console.log("✅ Symbol found:", document);

    // Fetch all ShareKhan clients from the database
    console.log("🔍 Fetching ShareKhan clients...");
    const clients = await ShareKhanUser.find();

    if (!clients || clients.length === 0) {
      console.error("❌ No ShareKhan clients found in database");
      return res.status(404).json({ error: "No ShareKhan clients found in database" });
    }

    // Filter clients that have required fields for trading
    const validClients = clients.filter(client => {
      const isValid = client.accessToken && client.apiKey && client.capital && client.capital > 0;
      if (!isValid) {
        console.warn(`⚠️ Client ${client.clientName} is missing required fields or has invalid capital`);
      }
      return isValid;
    });

    if (validClients.length === 0) {
      console.error("❌ No valid ShareKhan clients found");
      return res.status(404).json({ error: "No valid ShareKhan clients found" });
    }

    console.log(`✅ Found ${validClients.length} valid ShareKhan clients`);

    // Get credentials for API calls
    console.log("🔑 Getting credentials...");
    const credentials = await getNetworkCredentials();
    console.log("✅ Credentials obtained");

    // Process orders for all valid clients
    const orderPromises = validClients.map(async (client) => {
      try {
        console.log(`🔄 Processing order for ShareKhan client: ${client.clientName}`);
        
        const result = await shareKhanHandleClientOrder(
          client,
          document,
          price,
          transactionType,
          credentials,
          stopLoss
        );

        return {
          clientName: client.clientName,
          success: result.success,
          error: result.error || null,
          response: result.response || null
        };
      } catch (error) {
        console.error(`❌ Error processing order for ShareKhan client ${client.clientName}:`, error.message);
        return {
          clientName: client.clientName,
          success: false,
          error: error.message,
          response: null
        };
      }
    });

    // Wait for all orders to complete
    console.log("⏳ Waiting for all ShareKhan orders to complete...");
    const orderResults = await Promise.all(orderPromises);

    // Count successful and failed orders
    const successfulOrders = orderResults.filter(result => result.success);
    const failedOrders = orderResults.filter(result => !result.success);

    console.log("📊 ShareKhan Order Summary:");
    console.log(`   ✅ Successful: ${successfulOrders.length}`);
    console.log(`   ❌ Failed: ${failedOrders.length}`);
    console.log(`   📈 Total: ${orderResults.length}`);

    // Log individual results
    orderResults.forEach(result => {
      if (result.success) {
        console.log(`   ✅ ${result.clientName}: SUCCESS`);
      } else {
        console.log(`   ❌ ${result.clientName}: FAILED - ${result.error}`);
      }
    });

    console.log("🟢".repeat(50));
    console.log("🎉 SHAREKHAN PROCESSING COMPLETED");
    console.log("🟢".repeat(50));

    // Prepare response
    const response = {
      success: true,
      message: "ShareKhan orders processed",
      summary: {
        total: orderResults.length,
        successful: successfulOrders.length,
        failed: failedOrders.length
      },
      results: orderResults,
      parsedData: parsedData
    };

    console.log("📊 SHAREKHAN BROKER RESPONSE:");
    console.log(JSON.stringify(response, null, 2));
    console.log("🟢".repeat(50));

    // Return response
    return res.status(200).json(response);

  } catch (error) {
    console.error("💥 CRITICAL ERROR in ShareKhan endpoint:");
    console.error("   🔴 Error Type:", error.constructor.name);
    console.error("   📝 Error Message:", error.message);
    console.error("   📚 Stack Trace:", error.stack);

    return res.status(500).json({
      success: false,
      error: "Internal server error in ShareKhan processing",
      details: error.message
    });
  }
});

module.exports = router;
