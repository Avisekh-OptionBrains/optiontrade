const express = require("express");
const router = express.Router();

const IIFLRouter = require("./Brokers/IIFL/IIFL");

/**
 * Option Trade Strategy Router
 * Handles BB TRAP signals and places option orders
 */

// Mount IIFL broker route
router.use("/IIFL", IIFLRouter);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Option Trade strategy is running",
    timestamp: new Date().toISOString(),
    brokers: ["IIFL"]
  });
});

// Main webhook endpoint
router.post("/", async (req, res) => {
  console.log("Route: /OptionTrade");
  console.log("Received webhook:", req.body);

  try {
    const webhookData = req.body;

    // Extract message text
    let messageText = webhookData;
    if (typeof messageText === "object" && messageText.messageText) {
      messageText = messageText.messageText;
    } else if (typeof messageText === "object") {
      messageText = JSON.stringify(messageText);
    }

    // Validate BB TRAP signal
    if (!messageText || !messageText.includes("BB TRAP")) {
      return res.status(400).json({
        success: false,
        error: "Invalid signal. Expected BB TRAP format."
      });
    }

    console.log("✅ BB TRAP signal detected:", messageText);

    // Forward to IIFL broker
    const fakeReq = { ...req, url: "/OptionTrade/IIFL", method: "POST", body: webhookData };
    const fakeRes = {
      json: (data) => {
        console.log("IIFL Response:", data);
        return res.json({
          success: true,
          message: "Option trade processed",
          broker: "IIFL",
          result: data
        });
      },
      status: (code) => ({
        json: (data) => res.status(code).json(data)
      })
    };

    req.app.handle(fakeReq, fakeRes, (err) => {
      if (err) {
        console.error("Error forwarding to IIFL:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to process option trade"
        });
      }
    });

  } catch (error) {
    console.error("Error in OptionTrade handler:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

