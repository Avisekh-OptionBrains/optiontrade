const express = require("express");
const router = express.Router();

// Import broker handlers
const IIFLHandler = require("./Brokers/IIFL/IIFL");

// Health check endpoint
router.get("/", (req, res) => {
  console.log("Received GET request at /BankNifty");
  res.status(200).json({
    status: "success",
    message: "BankNifty strategy is running",
    timestamp: new Date().toISOString(),
  });
});

// IIFL Broker Route
router.use("/IIFL", IIFLHandler);

module.exports = router;

