const axios = require("axios");
const VERBOSE = process.env.TELEGRAM_LOG_VERBOSE === 'true';

function createFakeResponse(resolve) {
  return {
    status: () => ({
      json: resolve,
      send: resolve,
    }),
    json: resolve,
    send: resolve,
    end: resolve,
  };
}

// Function to escape special characters for MarkdownV2
function escapeMarkdownV2(text) {
  // MarkdownV2 requires escaping these characters: _*[]()~`>#+=|{}.!-
  // Must escape backslashes first to avoid double escaping
  return text
    .replace(/\\/g, "\\\\")  // Escape backslashes first
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");  // Then escape other special chars
}

async function sendMessageToTelegram(botToken, channelId, messageText, retryCount = 0, useMarkdown = true) {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second base delay

  try {
    // Validate credentials early
    if (!botToken || !channelId) {
      console.error("❌ TELEGRAM - Missing credentials:", {
        hasBotToken: !!botToken,
        hasChannelId: !!channelId
      });
      return { ok: false, error: "Missing Telegram credentials" };
    }

    if (!messageText || typeof messageText !== 'string') {
      console.error("❌ TELEGRAM - Invalid message text:", typeof messageText);
      return { ok: false, error: "Invalid message text provided" };
    }

    if (VERBOSE) {
      console.log(`🚀 TELEGRAM - Sending message (attempt ${retryCount + 1}/${maxRetries + 1})`);
      console.log(`   Channel ID: ${channelId}`);
      console.log(`   Message length: ${messageText.length} characters`);
      console.log(`   Parse mode: ${useMarkdown ? 'MarkdownV2' : 'None'}`);
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let requestData;

    if (useMarkdown) {
      // Try with MarkdownV2 first
      const escapedMessage = escapeMarkdownV2(messageText);
      requestData = {
        chat_id: channelId,
        text: escapedMessage,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        disable_notification: false
      };
    } else {
      // Fallback to plain text
      requestData = {
        chat_id: channelId,
        text: messageText,
        disable_web_page_preview: true,
        disable_notification: false
      };
    }

    const response = await axios.post(url, requestData, {
      timeout: 15000, // Increased to 15 seconds
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EpicRise-Bot/1.0"
      },
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors, handle them gracefully
      }
    });

    if (VERBOSE) {
      console.log("✅ TELEGRAM - API response received:");
      console.log(`   Status: ${response.status}`);
      console.log(`   OK: ${response.data?.ok}`);
      console.log(`   Message ID: ${response.data?.result?.message_id || 'N/A'}`);
    }

    // Validate response structure
    if (!response.data) {
      throw new Error("Empty response from Telegram API");
    }

    if (response.status >= 400) {
      const errorMsg = response.data?.description || `HTTP ${response.status}`;
      console.error(`❌ TELEGRAM - API error: ${errorMsg}`);

      // If MarkdownV2 parsing failed and we haven't tried plain text yet, retry with plain text
      if (response.status === 400 && useMarkdown &&
          (errorMsg.includes("can't parse entities") || errorMsg.includes("parse entities"))) {
        if (VERBOSE) console.log(`🔄 TELEGRAM - MarkdownV2 parsing failed, retrying with plain text...`);
        return sendMessageToTelegram(botToken, channelId, messageText, retryCount, false);
      }

      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500 && retryCount < maxRetries) {
        if (VERBOSE) console.log(`🔄 TELEGRAM - Retrying due to server error in ${retryDelay * (retryCount + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return sendMessageToTelegram(botToken, channelId, messageText, retryCount + 1, useMarkdown);
      }

      return {
        ok: false,
        error: `Telegram API error: ${errorMsg}`,
        details: response.data,
        httpStatus: response.status
      };
    }

    if (!response.data.ok) {
      const errorMsg = response.data.description || "Unknown API error";
      console.error(`❌ TELEGRAM - API returned ok: false - ${errorMsg}`);
      return {
        ok: false,
        error: `Telegram API error: ${errorMsg}`,
        details: response.data
      };
    }

    if (VERBOSE) console.log("🎉 TELEGRAM - Message sent successfully!");
    return {
      ok: true,
      data: response.data,
      messageId: response.data?.result?.message_id
    };

  } catch (error) {
    console.error(`❌ TELEGRAM - Request failed (attempt ${retryCount + 1})`);

    // Handle specific error types
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      if (retryCount < maxRetries) {
        if (VERBOSE) console.log(`🔄 TELEGRAM - Retrying due to timeout in ${retryDelay * (retryCount + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return sendMessageToTelegram(botToken, channelId, messageText, retryCount + 1, useMarkdown);
      }
      return {
        ok: false,
        error: `Request timed out after ${maxRetries + 1} attempts`,
        details: error.message,
      };
    }

    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return {
        ok: false,
        error: "Network connection failed - check internet connectivity",
        details: error.message,
      };
    }

    // Retry on network errors
    if (retryCount < maxRetries && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
      if (VERBOSE) console.log(`🔄 TELEGRAM - Retrying due to network error in ${retryDelay * (retryCount + 1)}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
      return sendMessageToTelegram(botToken, channelId, messageText, retryCount + 1, useMarkdown);
    }

    return {
      ok: false,
      error: error.message || "Unknown error occurred",
      details: error.response?.data || error.message,
      code: error.code
    };
  }
}

function EangelparseMessageText(messageText) {
  if (!messageText || typeof messageText !== "string") {
    console.error("Invalid messageText input:", typeof messageText, messageText);
    return null;
  }

  // Clean the message text
  const cleanMessage = messageText.trim().replace(/\s+/g, " ");
  console.log("Cleaned message:", cleanMessage);

  // Updated regex to be more flexible with case and spacing
  const regex = /ER\s+(Buy|Sell)\s+(\w+)\s+at\s+(\d+(?:\.\d+)?)\s+with\s+Stop\s+Loss\s+at\s+(\d+(?:\.\d+)?)/i;
  const match = cleanMessage.match(regex);

  if (match) {
    const parsed = {
      transactionType: match[1],
      symbol: match[2],
      price: parseFloat(match[3]),
      stopLoss: parseFloat(match[4]),
    };
    console.log("Successfully parsed message:", parsed);
    return parsed;
  }

  // Try alternative formats
  const alternativeRegex = /(Buy|Sell)\s+(\w+)\s+at\s+(\d+(?:\.\d+)?)\s+with\s+Stop\s+Loss\s+at\s+(\d+(?:\.\d+)?)/i;
  const altMatch = cleanMessage.match(alternativeRegex);

  if (altMatch) {
    const parsed = {
      transactionType: altMatch[1],
      symbol: altMatch[2],
      price: parseFloat(altMatch[3]),
      stopLoss: parseFloat(altMatch[4]),
    };
    console.log("Successfully parsed message with alternative format:", parsed);
    return parsed;
  }

  console.error("Failed to parse message:", cleanMessage);
  console.error("Expected format: 'ER Buy/Sell SYMBOL at PRICE with Stop Loss at STOPLOSS'");
  return null;
}

const BUY_ADJUSTMENT = 1.0025;
const SELL_ADJUSTMENT = 0.9975;

///////// All changes  are done successfully
module.exports = {
  createFakeResponse,
  sendMessageToTelegram,
  EangelparseMessageText,
  /// PRICES EDJUSTMENT VARIABLES//
  BUY_ADJUSTMENT,
  SELL_ADJUSTMENT,
};
