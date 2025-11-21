const express = require("express");
const router = express.Router();
const { processBBTrapSignal } = require("./optionTradingHandler");

/**
 * IIFL Option Trading Handler
 * Processes BB TRAP signals and places option orders
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║         OPTIONTRADE - IIFL HANDLER TRIGGERED              ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));

    // Extract message text
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
    console.log("\n🚀 Starting BB TRAP signal processing...\n");

    // Process the BB TRAP signal
    const result = await processBBTrapSignal(messageText);

    const processingTime = Date.now() - startTime;

    if (result.success) {
      console.log("\n╔════════════════════════════════════════════════════════════╗");
      console.log("║              ✅ PROCESSING SUCCESSFUL                      ║");
      console.log("╚════════════════════════════════════════════════════════════╝");

      console.log("\n📊 PROCESSING SUMMARY:");
      console.log("─────────────────────────────────────────────────────────────");
      console.log(`⏱️  Processing Time: ${processingTime}ms`);

      // Only show signal details if it's an entry signal (not exit)
      if (result.signal && result.signal.action) {
        console.log(`\n📈 Signal Details:`);
        console.log(`   Action: ${result.signal.action.toUpperCase()}`);
        console.log(`   Symbol: ${result.signal.symbol}`);
        console.log(`   Entry Price: ₹${result.signal.entryPrice}`);
        console.log(`   Stop Loss: ₹${result.signal.stopLoss}`);
        console.log(`   Target: ₹${result.signal.target}`);
      } else if (result.exitType) {
        console.log(`\n📈 Exit Signal:`);
        console.log(`   Type: ${result.exitType}`);
        console.log(`   Symbol: ${result.symbol || 'N/A'}`);
        console.log(`   Exit Price: ₹${result.exitPrice || 'N/A'}`);
      }

      // Only show orders if they exist
      if (result.orders && result.orders.length > 0) {
        console.log(`\n📋 Orders Placed: ${result.orders.length}`);
        result.orders.forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price} (Security ID: ${order.security_id})`);
        });
      }

      // Only show results if they exist
      if (result.results && result.results.length > 0) {
        const successCount = result.results.filter(r => r.success).length;
        const failCount = result.results.filter(r => !r.success).length;

        console.log(`\n✅ Order Results:`);
        console.log(`   Successful: ${successCount}/${result.results.length}`);
        console.log(`   Failed: ${failCount}/${result.results.length}`);
      }

      if (result.trade) {
        console.log(`\n💾 Database:`);
        console.log(`   Trade ID: ${result.trade.id}`);
        console.log(`   Status: ${result.trade.status}`);
      } else if (result.message) {
        console.log(`\n💬 Message: ${result.message}`);
      }

      console.log("\n════════════════════════════════════════════════════════════\n");

      return res.json({
        success: true,
        message: "BB TRAP option orders processed successfully",
        signal: result.signal,
        orders: result.orders,
        results: result.results,
        trade: result.trade ? {
          id: result.trade.id,
          status: result.trade.status
        } : null,
        processingTime: `${processingTime}ms`
      });
    } else {
      console.log("\n╔════════════════════════════════════════════════════════════╗");
      console.log("║              ❌ PROCESSING FAILED                          ║");
      console.log("╚════════════════════════════════════════════════════════════╝");
      console.log(`\n⏱️  Processing Time: ${processingTime}ms`);
      console.log(`❌ Error: ${result.error}`);
      console.log("\n════════════════════════════════════════════════════════════\n");

      return res.status(500).json({
        success: false,
        error: result.error || "Failed to process BB TRAP signal",
        processingTime: `${processingTime}ms`
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║              ❌ EXCEPTION OCCURRED                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n⏱️  Processing Time: ${processingTime}ms`);
    console.error(`❌ Exception: ${error.message}`);
    console.error(`📍 Stack Trace:\n${error.stack}`);
    console.log("\n════════════════════════════════════════════════════════════\n");

    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message,
      processingTime: `${processingTime}ms`
    });
  }
});

/**
 * Health check endpoint
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "IIFL option trading service is running",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

