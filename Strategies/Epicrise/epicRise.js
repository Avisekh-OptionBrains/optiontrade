const express = require("express");
const router = express.Router();

const IIFLRouter = require("./Brokers/IIFL/IIFL");

/**
 * Epicrise Main Webhook Handler
 * Directly processes trading signals using IIFL broker (no forwarding)
 * Same approach as OptionTrade and BankNifty strategies
 */
router.post("/", async (req, res) => {
  console.log("🎯 Epicrise webhook received");
  console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));

  try {
    // Forward directly to IIFL handler (no separate forwarding)
    // This uses the same direct execution pattern as OptionTrade and BankNifty
    // Call the IIFL router's POST handler directly
    return IIFLRouter.handle(req, res);
  } catch (error) {
    console.error("❌ Error in Epicrise handler:", error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message
      });
    }
  }
});

// Attach child routes
router.use("/IIFL", IIFLRouter);

module.exports = router;
