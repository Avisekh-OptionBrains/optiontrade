const express = require("express");

const router = express.Router();
const { EangelparseMessageText } = require("../../Utils/utilities");
const { getNetworkCredentials } = require("../../../../utils/networkInfo");
const { findSymbolInDatabase } = require("../../../../newdb");
const Angeluser = require("../../../../models/Angeluser");
const { angelhandleClientOrder } = require("./AngelUtils");

router.post("/", async (req, res) => {
  console.log("Angel broker received request:", req.body);

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

  // Validate parsed data
  if (!parsedData) {
    console.error("Failed to parse message:", messageText);
    return res.status(400).json({ error: "Invalid message format. Expected format: 'ER Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'" });
  }

  console.log("Parsed data:", parsedData);
  const { symbol, price, transactionType, stopLoss } = parsedData;

  try {
    // Fetch credentials
    console.log("Fetching credentials...");
    const credentials = await getNetworkCredentials();
    if (
      !credentials.macAddress ||
      !credentials.localIp ||
      !credentials.publicIp
    ) {
      console.error("Missing credentials:", credentials);
      return res.status(400).json({ error: "Missing required credentials" });
    }
    console.log("Credentials fetched successfully");

    // Find the symbol in the database
    console.log("Finding symbol in database:", symbol);
    const document = await findSymbolInDatabase(symbol);
    if (!document) {
      console.error("Symbol not found in database:", symbol);
      return res.status(404).json({ error: `Symbol ${symbol} not found in database` });
    }
    console.log("Symbol found:", document);

    // Fetch all clients from the database
    console.log("Fetching Angel clients...");
    const clients = await Angeluser.find();

    if (!clients || clients.length === 0) {
      console.error("No Angel clients found in database");
      return res.status(404).json({ error: "No Angel clients found in database" });
    }

    // Filter clients that have required fields for trading
    const validClients = clients.filter(client => {
      const isValid = client.jwtToken &&
                     client.apiKey &&
                     client.capital &&
                     client.capital > 0 &&
                     client.state === 'live'; // Only include live/active users

      if (!isValid) {
        console.warn(`⚠️ Client ${client.clientName} is INVALID:`, {
          hasJwtToken: !!client.jwtToken,
          hasApiKey: !!client.apiKey,
          hasCapital: !!client.capital,
          capitalValue: client.capital,
          state: client.state,
          isLive: client.state === 'live'
        });
      } else {
        console.log(`✅ Client ${client.clientName} is VALID for trading`);
      }
      return isValid;
    });

    if (validClients.length === 0) {
      console.error("No valid Angel clients found (missing jwtToken, apiKey, or capital)");
      return res.status(404).json({ error: "No valid Angel clients found. Clients must have jwtToken, apiKey, and capital > 0" });
    }

    console.log(`Found ${clients.length} Angel clients, ${validClients.length} are valid for trading`);

    // Place orders for each valid client asynchronously
    const ordersPromises = validClients.map((client) => {
      console.log(`Processing order for client: ${client.clientName}`);
      return angelhandleClientOrder(
        client,
        document,
        price,
        transactionType,
        credentials,
        stopLoss
      );
    });

    const results = await Promise.allSettled(ordersPromises);

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Order processing complete: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error("Some orders failed:", results.filter(r => r.status === 'rejected'));
    }

    res.json({
      message: `Orders processed for ${validClients.length} Angel clients. ${successful} successful, ${failed} failed. Stop-loss orders will be placed shortly.`,
      results: {
        total: validClients.length,
        successful,
        failed,
        totalClientsInDB: clients.length,
        validClients: validClients.length
      }
    });
  } catch (error) {
    console.error("Error handling Angel broker request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
