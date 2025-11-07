const express = require("express");
const {
  sendMessageToTelegram,
  CmiparseMessageText,
} = require("./utilities");
const router = express.Router();
const CONFIG = require("./config");

// Helper function to safely stringify objects
function safeStringify(obj) {
  try {
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === "object" && value !== null) {
          // Skip circular references
          if (key === "req" || key === "res" || key === "rawResponse") {
            return "[Circular]";
          }
          return value;
        }
        return value;
      },
      2
    );
  } catch (error) {
    return "[Error stringifying object]";
  }
}

// Add status indicator
let lastMessageTime = null;

function formatTradingMessage(messageText) {
  const parsedData = CmiparseMessageText(messageText);
  if (!parsedData) {
    return null;
  }

  const { transactionType, symbol, price, stopLoss } = parsedData;

  const mainEmoji = transactionType.toLowerCase() === "buy" ? "📈" : "📉";
  const actionEmoji = transactionType.toLowerCase() === "buy" ? "🟢" : "🔴";

  const riskPerShare = Math.abs(stopLoss - price).toFixed(2);
  const riskPercentage = ((Math.abs(stopLoss - price) / price) * 100).toFixed(
    2
  );

  return `${mainEmoji} CMI TRADING SIGNAL ${mainEmoji}

${actionEmoji} Action: ${transactionType.toUpperCase()}
📌 Symbol: ${symbol}
💰 Entry Price: ₹${price.toFixed(2)}
🛑 Stop Loss: ₹${stopLoss.toFixed(2)}

📊 Risk Management:
├─ Risk per share: ₹${riskPerShare}
└─ Risk percentage: ${riskPercentage}%

⚠️ Note: Always use proper risk management and position sizing.`;
}

// Add status check endpoint
router.get("/status", (req, res) => {
  const botToken = CONFIG.QUICKFLIP.TELEGRAM_BOT_TOKEN;
  const channelId = CONFIG.QUICKFLIP.CHANNEL_ID;

  res.json({
    status: "running",
    lastMessageTime,
    uptime: process.uptime(),
    config: {
      hasBotToken: !!botToken,
      hasChannelId: !!channelId,
    },
  });
});

router.post("/", async (req, res) => {
  console.log("CMI Telegram router received request:", safeStringify(req.body));

  try {
    const botToken = CONFIG.QUICKFLIP.TELEGRAM_BOT_TOKEN;
    const channelId = CONFIG.QUICKFLIP.CHANNEL_ID;

    if (!botToken || !channelId) {
      console.error("Missing CMI Telegram credentials:", {
        hasBotToken: !!botToken,
        hasChannelId: !!channelId,
      });
      return res.status(500).json({ error: "Missing CMI Telegram credentials" });
    }

    const messageText =
      typeof req.body === "string" ? req.body : req.body.message;
    if (!messageText) {
      console.error("No message provided in request body");
      return res.status(400).json({ error: "No message provided" });
    }

    // Parse the original message to extract trading details
    const parsedData = CmiparseMessageText(messageText);
    if (!parsedData) {
      console.error("Failed to parse CMI message:", messageText);
      return res.status(400).json({ error: "Failed to parse CMI message" });
    }

    // Format the message for Telegram
    const formattedMessage = formatTradingMessage(messageText);
    if (!formattedMessage) {
      console.error("Failed to format CMI message:", messageText);
      return res.status(400).json({ error: "Failed to format CMI message" });
    }

    // Save message to database
    const OrderModel = require('../../../models/orderModel');
    const newMessage = new OrderModel({
      token: parsedData.symbol,
      symbol: parsedData.symbol,
      transactionType: parsedData.transactionType,
      message: formattedMessage,
      price: parsedData.price,
      strategy: 'CMI'
    });

    try {
      await newMessage.save();
      console.log('Saved CMI message to database:', {
        symbol: newMessage.symbol,
        transactionType: newMessage.transactionType,
        price: newMessage.price,
        strategy: newMessage.strategy
      });

      // Broadcast new message via WebSocket
      if (global.wsManager) {
        global.wsManager.broadcastNewMessage({
          symbol: newMessage.symbol,
          transactionType: newMessage.transactionType,
          price: newMessage.price,
          message: formattedMessage,
          strategy: 'CMI'
        });
      }
    } catch (error) {
      console.error('Failed to save CMI message to database:', error);
      return res.status(500).json({ 
        error: "Failed to save CMI message to database",
        details: error.message
      });
    }

    // Send message to Telegram
    console.log("📤 CMI TELEGRAM - Attempting to send message to Telegram...");
    try {
      const result = await sendMessageToTelegram(
        botToken,
        channelId,
        formattedMessage
      );

      if (!result.ok) {
        console.error("❌ CMI TELEGRAM - Failed to send message:", {
          error: result.error,
          details: result.details,
          httpStatus: result.httpStatus,
          code: result.code
        });

        // Return proper error response - don't claim success when it failed
        return res.status(500).json({
          success: false,
          error: "Failed to send CMI message to Telegram",
          details: result.error,
          telegramError: result.details,
          httpStatus: result.httpStatus
        });
      }

      console.log("✅ CMI TELEGRAM - Message sent successfully!");
      console.log(`   Message ID: ${result.messageId}`);

      lastMessageTime = new Date().toISOString();
      res.json({
        success: true,
        message: "CMI message sent successfully and saved to database",
        savedMessage: newMessage,
        telegramMessageId: result.messageId
      });
    } catch (error) {
      console.error("❌ CMI TELEGRAM - Unexpected error:", {
        message: error.message,
        stack: error.stack
      });

      // Return proper error response
      return res.status(500).json({
        success: false,
        error: "Failed to send CMI message to Telegram",
        details: error.message,
        type: "unexpected_error"
      });
    }
  } catch (error) {
    console.error("Error in CMI Telegram router:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
