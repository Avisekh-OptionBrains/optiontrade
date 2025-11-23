const express = require("express");

const router = express.Router();
const { CmiparseMessageText } = require("../../Utils/utilities");
const { findSymbolInDatabase } = require("../../../../newdb");
const IIFLUser = require("../../../../models/IIFLUser");
const { placeOrdersForAllUsers } = require("./CMI_IIFLUtils");

/**
 * CMI IIFL Trading Signal Handler
 * Processes trading signals and places orders for all IIFL users
 */
router.post("/", async (req, res) => {
  try {
    console.log("🎯 CMI IIFL trading signal received:");
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
      console.error("❌ CMI IIFL - Invalid messageText received:", messageText);
      return res.status(400).json({ 
        error: "Message text is required and must be a string" 
      });
    }

    console.log("📝 CMI IIFL - Processing messageText:", messageText);
    const parsedData = CmiparseMessageText(messageText);

    // Validate parsed data
    if (!parsedData) {
      console.error("❌ CMI IIFL - Failed to parse message:", messageText);
      return res.status(400).json({ 
        error: "Invalid message format. Expected format: 'CMI Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" 
      });
    }

    console.log("✅ CMI IIFL - Message parsed successfully:");
    console.log(JSON.stringify(parsedData, null, 2));
    const { symbol, price, transactionType, stopLoss } = parsedData;

    // Find symbol in database
    console.log(`🔍 CMI IIFL - Looking up symbol: ${symbol}`);
    const symbolData = await findSymbolInDatabase(symbol);
    if (!symbolData) {
      console.error(`❌ CMI IIFL - Symbol not found: ${symbol}`);
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }

    console.log("✅ CMI IIFL - Symbol found:", symbolData);

    // Map transactionType to action format expected by IIFL
    const action = transactionType.toUpperCase(); // "Buy" -> "BUY", "Sell" -> "SELL"

    console.log(`🎯 CMI IIFL Order Details: ${action} ${symbol} at ₹${price} (SL: ₹${stopLoss})`);

    // Place orders for all IIFL users using the existing function
    console.log("🚀 Starting CMI IIFL order placement...");
    const results = await placeOrdersForAllUsers(
      symbol,
      action, // Use the mapped action parameter
      price,
      stopLoss
    );

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`📊 CMI IIFL - Processing complete: ${successCount} successful, ${errorCount} failed`);

    res.status(200).json({
      message: "CMI IIFL orders processed",
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount
      },
      results
    });

  } catch (error) {
    console.error("❌ CMI IIFL - Unexpected error:", error);
    res.status(500).json({ 
      error: "Internal server error in CMI IIFL broker",
      details: error.message
    });
  }
});

module.exports = router;
