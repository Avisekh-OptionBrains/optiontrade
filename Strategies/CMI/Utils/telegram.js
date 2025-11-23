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

// Add status check endpoint
router.get("/status", (req, res) => {
  const botToken = CONFIG.FLASH45.TELEGRAM_BOT_TOKEN;
  const channelId = CONFIG.FLASH45.CHANNEL_ID;

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
  console.log("\n" + "=".repeat(80));
  console.log("📨 CMI TELEGRAM HANDLER");
  console.log("=".repeat(80));
  console.log("📋 Request Body Type:", typeof req.body);
  console.log("📋 Request Body:", safeStringify(req.body));
  console.log("=".repeat(80));

  try {
    const botToken = CONFIG.FLASH45.TELEGRAM_BOT_TOKEN;
    const channelId = CONFIG.FLASH45.CHANNEL_ID;

    console.log("🔑 Telegram Config:");
    console.log(`   Bot Token: ${botToken ? botToken.substring(0, 20) + '...' : 'MISSING'}`);
    console.log(`   Channel ID: ${channelId || 'MISSING'}`);

    if (!botToken || !channelId) {
      console.error("❌ Missing CMI Telegram credentials:", {
        hasBotToken: !!botToken,
        hasChannelId: !!channelId,
      });
      return res.status(500).json({ error: "Missing CMI Telegram credentials" });
    }

    const messageText =
      typeof req.body === "string" ? req.body : req.body.message;

    console.log("\n📝 Extracted Message:");
    console.log(`   Type: ${typeof messageText}`);
    console.log(`   Length: ${messageText?.length || 0} characters`);
    console.log(`   Content: ${messageText}`);

    if (!messageText) {
      console.error("❌ No message provided in request body");
      return res.status(400).json({ error: "No message provided" });
    }

    // Just forward the raw message as-is to Telegram with a simple header
    const formattedMessage = `🔔 CMI Strategy Alert\n\n${messageText}`;

    console.log("\n📤 Message to Send to Telegram:");
    console.log(formattedMessage);
    console.log("=".repeat(80));

    // Try to parse for database storage (optional, won't block if parsing fails)
    let parsedData = null;
    try {
      parsedData = CmiparseMessageText(messageText);
    } catch (parseError) {
      console.log("⚠️ Could not parse message for database, will save raw message:", parseError.message);
    }

    // Save message to database (use parsed data if available, otherwise raw)
    const OrderModel = require('../../../models/orderModel');
    const newMessage = new OrderModel({
      token: parsedData?.symbol || 'CMI',
      symbol: parsedData?.symbol || 'CMI',
      transactionType: parsedData?.transactionType || 'UNKNOWN',
      message: messageText, // Save original raw message
      price: parsedData?.price || 0,
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
          message: messageText, // Broadcast original message
          strategy: 'CMI'
        });
      }
    } catch (error) {
      console.error('Failed to save CMI message to database:', error);
      // Don't fail the request if database save fails, continue to send to Telegram
      console.log('⚠️ Continuing to send to Telegram despite database error');
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
