const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Import routes
const epicriseRouter = require("./Strategies/Epicrise");
const bankNiftyRouter = require("./Strategies/BankNifty");
const optionTradeRouter = require("./Strategies/OptionTrade");
const telegramRouter = require("./Strategies/Epicrise/Utils/telegram");
const orderResponsesRouter = require("./routes/orderResponses");

// Routes
app.use("/Epicrise", epicriseRouter);
app.use("/BankNifty", bankNiftyRouter);
app.use("/OptionTrade", optionTradeRouter);
app.use("/api/epicrise", epicriseRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/order-responses", orderResponsesRouter);

// Root endpoint
app.post("/", async (req, res) => {
  console.log("📥 Webhook received at root endpoint");
  console.log("📨 Body:", req.body);

  // Forward to appropriate strategy based on message content
  let messageText = req.body;
  if (typeof messageText === "object" && messageText.messageText) {
    messageText = messageText.messageText;
  } else if (typeof messageText === "object") {
    messageText = JSON.stringify(messageText);
  }

  if (!messageText) {
    return res.status(400).json({ error: "No message text provided" });
  }

  // Determine which strategy to use
  if (messageText.includes("ER ")) {
    console.log("🎯 Routing to Epicrise");
    return epicriseRouter(req, res);
  } else if (messageText.includes("BB TRAP") && messageText.includes("BANKNIFTY")) {
    console.log("🎯 Routing to BankNifty");
    return bankNiftyRouter(req, res);
  } else if (messageText.includes("BB TRAP") && messageText.includes("NIFTY")) {
    console.log("🎯 Routing to OptionTrade");
    return optionTradeRouter(req, res);
  } else {
    return res.status(400).json({ error: "Unknown signal format" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
