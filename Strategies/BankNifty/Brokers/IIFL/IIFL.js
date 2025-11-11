const express = require("express");
const router = express.Router();
const { processBBTrapSignal } = require("./bankNiftyTradingHandler");

/**
 * Health check endpoint
 */
router.get("/", (req, res) => {
  console.log("Received GET request at /BankNifty/IIFL");
  res.status(200).json({
    status: "success",
    message: "IIFL BankNifty trading service is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * IIFL BankNifty Option Trading Handler
 * Processes BB TRAP signals and places option orders
 */

// Main endpoint to receive BB TRAP signals for BankNifty
router.post("/", async (req, res) => {
  const startTime = Date.now();

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║         BANKNIFTY - IIFL HANDLER TRIGGERED                ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));

  try {
    // Extract message text (same logic as OptionTrade)
    let messageText = req.body;
    if (typeof messageText === "object" && messageText.messageText) {
      messageText = messageText.messageText;
    } else if (typeof messageText === "object") {
      messageText = JSON.stringify(messageText);
    }

    // Validate message text
    if (!messageText || typeof messageText !== "string") {
      console.error("❌ Invalid messageText received:", messageText);
      console.log("════════════════════════════════════════════════════════════\n");
      return res.status(400).json({
        success: false,
        error: "Message text is required and must be a string"
      });
    }

    console.log(`\n📨 Message Text: "${messageText}"`);

    // Check if this is a BB TRAP signal
    if (!messageText.includes("BB TRAP")) {
      console.log("⚠️  Not a BB TRAP signal - Ignoring");
      console.log("════════════════════════════════════════════════════════════\n");
      return res.status(400).json({
        success: false,
        error: "Not a BB TRAP signal"
      });
    }

    console.log("✅ BB TRAP signal detected!");
    console.log("\n🚀 Starting BB TRAP signal processing for BankNifty...\n");

    // Process the BB TRAP signal
    const result = await processBBTrapSignal(messageText);

    const processingTime = Date.now() - startTime;

    if (result.success) {
      console.log("\n╔════════════════════════════════════════════════════════════╗");
      console.log("║              ✅ PROCESSING SUCCESSFUL                      ║");
      console.log("╚════════════════════════════════════════════════════════════╝");
      console.log("\n📊 PROCESSING SUMMARY:");
      console.log("─────────────────────────────────────────────────────────────");
      console.log(`⏱️  Processing Time: ${processingTime}ms\n`);

      // Only show signal details if it's an entry signal (not exit)
      if (result.signal && result.signal.action) {
        console.log(`📈 Signal Details:`);
        console.log(`   Action: ${result.signal.action.toUpperCase()}`);
        console.log(`   Symbol: ${result.signal.symbol}`);
        console.log(`   Entry Price: ₹${result.signal.entryPrice}`);
        console.log(`   Stop Loss: ₹${result.signal.stopLoss}`);
        console.log(`   Target: ₹${result.signal.target}\n`);
      } else if (result.exitType) {
        console.log(`📈 Exit Signal:`);
        console.log(`   Type: ${result.exitType}`);
        console.log(`   Symbol: ${result.symbol || 'N/A'}`);
        console.log(`   Exit Price: ₹${result.exitPrice || 'N/A'}\n`);
      }

      // Only show orders if they exist
      if (result.orders && result.orders.length > 0) {
        console.log(`📋 Orders Placed: ${result.orders.length}`);
        result.orders.forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price} (Security ID: ${order.security_id})`);
        });
      }

      // Only show results if they exist
      if (result.results && result.results.length > 0) {
        console.log(`\n✅ Order Results:`);
        const successful = result.results.filter(r => r.success).length;
        const failed = result.results.filter(r => !r.success).length;
        console.log(`   Successful: ${successful}/${result.results.length}`);
        console.log(`   Failed: ${failed}/${result.results.length}\n`);
      }

      console.log(`💾 Database:`);
      if (result.trade && result.trade._id) {
        console.log(`   Trade ID: ${result.trade._id}`);
        console.log(`   Status: ${result.trade.status}`);
      } else {
        console.log(`   Saved to backup JSON file`);
      }
      console.log("\n════════════════════════════════════════════════════════════");

      return res.status(200).json({
        status: "success",
        message: "BB TRAP signal processed successfully for BankNifty",
        data: result,
        processingTime: `${processingTime}ms`,
      });
    } else {
      console.log("\n╔════════════════════════════════════════════════════════════╗");
      console.log("║              ❌ PROCESSING FAILED                          ║");
      console.log("╚════════════════════════════════════════════════════════════╝");
      console.log(`\n❌ Error: ${result.error}`);
      console.log(`⏱️  Processing Time: ${processingTime}ms\n`);

      return res.status(500).json({
        status: "error",
        message: "Failed to process BB TRAP signal for BankNifty",
        error: result.error,
        processingTime: `${processingTime}ms`,
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("\n╔════════════════════════════════════════════════════════════╗");
    console.error("║              ❌ UNEXPECTED ERROR                           ║");
    console.error("╚════════════════════════════════════════════════════════════╝");
    console.error(`\n❌ Error: ${error.message}`);
    console.error(`📚 Stack Trace:\n${error.stack}`);
    console.error(`⏱️  Processing Time: ${processingTime}ms\n`);

    return res.status(500).json({
      status: "error",
      message: "Internal server error while processing BankNifty signal",
      error: error.message,
      processingTime: `${processingTime}ms`,
    });
  }
});

module.exports = router;

