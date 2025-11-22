const express = require("express");
const router = express.Router();
const { placeOrdersForSubscribedEpicriseUsers, sendTelegramNotification } = require("./IIFLUtils");

/**
 * IIFL Trading Signal Handler
 * Processes trading signals and places orders for all IIFL users
 */
router.post("/", async (req, res) => {
  try {
    console.log("IIFL signal received");

    let signal = null;

    // Handle JSON format (direct object with symbol, price, transactionType, stopLoss)
    if (typeof req.body === "object" && req.body.symbol && req.body.price !== undefined) {
      
      signal = {
        symbol: req.body.symbol.toUpperCase(),
        price: parseFloat(req.body.price),
        transactionType: req.body.transactionType,
        stopLoss: parseFloat(req.body.stopLoss)
      };
    } else {
      // Handle text format (messageText)
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

      

      // Use the same parsing function as other brokers
      const { EangelparseMessageText } = require("../../Utils/utilities");
      signal = EangelparseMessageText(messageText);
    }

    // Validate parsed data
    if (!signal) {
      console.error("Failed to parse message:", JSON.stringify(req.body));
      return res.status(400).json({
        success: false,
        error: "Invalid message format. Expected format: 'ER Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS' or JSON with symbol, price, transactionType, stopLoss"
      });
    }

    
    const { symbol, price, transactionType, stopLoss } = signal;

    // Map transactionType to action format expected by IIFL
    const action = transactionType.toUpperCase(); // "Buy" -> "BUY", "Sell" -> "SELL"

    console.log(`IIFL Order: ${action} ${symbol} ₹${price} SL ₹${stopLoss}`);

    // Place orders for all IIFL users
    
    const results = await placeOrdersForSubscribedEpicriseUsers(
      symbol,
      action, // Use the mapped action parameter
      price,
      stopLoss
    );

    // Prepare response
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Summary: success ${successful.length}, failed ${failed.length}, total ${results.length}`);

    // Log individual results
    

    // Send Telegram notification (always, even if some orders failed)
    
    const telegramResult = await sendTelegramNotification(symbol, action, price, stopLoss, results);
    if (!telegramResult.success) {
      console.log(`Telegram failed: ${telegramResult.error}`);
    }

    const response = {
      success: true,
      message: "IIFL orders processed",
      signal: signal,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: results,
      telegram: telegramResult
    };

    console.log("IIFL processing completed");

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
