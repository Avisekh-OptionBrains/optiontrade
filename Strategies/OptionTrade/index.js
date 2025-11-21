const express = require("express");
const router = express.Router();

const IIFLRouter = require("./Brokers/IIFL/IIFL");

/**
 * Option Trade Strategy Router
 * Handles BB TRAP signals and places option orders
 */

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Option Trade strategy is running",
    timestamp: new Date().toISOString(),
    brokers: ["IIFL"]
  });
});

// Mount IIFL broker route
router.use("/IIFL", IIFLRouter);

module.exports = router;

