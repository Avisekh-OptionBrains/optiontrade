const express = require("express");
const router = express.Router();
const { placeOrdersForAllUsers } = require("./IIFLUtils");

/**
 * IIFL Trading Signal Handler
 * Processes trading signals and places orders for all IIFL users
 */
router.post("/", async (req, res) => {
  try {
    console.log("🎯 IIFL trading signal received:");
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
      return res.status(400).json({
        success: false,
        error: "Message text is required and must be a string"
      });
    }

    console.log("Processing messageText:", messageText);

    // Use the same parsing function as other brokers
    const { EangelparseMessageText } = require("../../Utils/utilities");
    const signal = EangelparseMessageText(messageText);

    // Validate parsed data (same as Motilal)
    if (!signal) {
      console.error("Failed to parse message:", messageText);
      return res.status(400).json({
        success: false,
        error: "Invalid message format. Expected format: 'ER Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'"
      });
    }

    console.log("📊 Parsed IIFL signal:", signal);
    const { symbol, price, transactionType, stopLoss } = signal;

    // Map transactionType to action format expected by IIFL
    const action = transactionType.toUpperCase(); // "Buy" -> "BUY", "Sell" -> "SELL"

    console.log(`🎯 IIFL Order Details: ${action} ${symbol} at ₹${price} (SL: ₹${stopLoss})`);

    // Place orders for all IIFL users
    console.log("🚀 Starting IIFL order placement...");
    const results = await placeOrdersForAllUsers(
      symbol,
      action, // Use the mapped action parameter
      price,
      stopLoss
    );

    // Prepare response
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log("📊 IIFL Order Summary:");
    console.log(`   ✅ Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   📈 Total: ${results.length}`);

    // Log individual results
    results.forEach(result => {
      if (result.success) {
        console.log(`   ✅ ${result.user}: SUCCESS`);
      } else {
        console.log(`   ❌ ${result.user}: FAILED - ${result.error}`);
      }
    });

    const response = {
      success: true,
      message: "IIFL orders processed",
      signal: signal,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: results
    };

    console.log("🎯".repeat(50));
    console.log("✅ IIFL PROCESSING COMPLETED");
    console.log("🎯".repeat(50));
    console.log("📊 IIFL BROKER RESPONSE:");
    console.log(JSON.stringify(response, null, 2));
    console.log("🎯".repeat(50));

    res.json(response);

  } catch (error) {
    console.error("❌ Error in IIFL trading handler:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error",
      details: error.message
    });
  }
});

// parseSignal function removed - now using EangelparseMessageText for consistency

/**
 * Health check endpoint
 */
router.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "IIFL broker service is running",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
