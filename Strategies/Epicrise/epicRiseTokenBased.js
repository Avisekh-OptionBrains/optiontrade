/**
 * Epic Rise Strategy - Token-Based Execution
 * Uses tokens from subscription system instead of direct database queries
 */
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const prisma = require("../../prismaClient");
const { EangelparseMessageText, createFakeResponse, sendMessageToTelegram } = require("./Utils/utilities.js");

// ===== STANDARD INTERFACES =====
class StandardSignalData {
  constructor(data) {
    this.messageText = data.messageText || data;
    this.symbol = null;
    this.transactionType = null;
    this.price = null;
    this.stopLoss = null;
    this.timestamp = new Date().toISOString();
    this.strategy = "epic_rise_carry_forward_strangle_001";
  }
}

// ===== TOKEN RETRIEVAL =====
/**
 * Get all active tokens for Epic Rise strategy
 */
async function getActiveTokensForStrategy() {
  try {
    console.log("🔍 Fetching active tokens for Epic Rise strategy...");
    
    // Fetch all active Epic Rise subscriptions
    const subscriptions = await prisma.epicriseSubscription.findMany({
      where: { enabled: true }
    });
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("⚠️ No active Epic Rise subscriptions found");
      return [];
    }
    
    console.log(`📊 Found ${subscriptions.length} active subscriptions`);
    
    const tokens = [];
    
    // For each subscription, get user and broker info
    for (const subscription of subscriptions) {
      try {
        // Get IIFL user
        const user = await prisma.iIFLUser.findFirst({
          where: { userID: subscription.userID, state: "live" }
        });
        
        if (!user) {
          console.log(`⚠️ No live IIFL user found for subscription ${subscription.userID}`);
          continue;
        }
        
        // Create token object
        const token = {
          tokenId: `${subscription.userID}_epicrise_${subscription.id}`,
          userId: subscription.userID,
          clientId: user.userID,
          clientName: user.clientName,
          clientEmail: user.email,
          brokerType: 'IIFL',
          allocatedCapital: subscription.capital || user.capital || 0,
          
          // User credentials
          isIntegrationManaged: user.password === "INTEGRATION_MANAGED",
          token: user.token,
          tokenValidity: user.tokenValidity,
          
          // Full user object for execution
          userObject: user,
          subscription: subscription
        };
        
        tokens.push(token);
        
      } catch (error) {
        console.error(`❌ Error processing subscription ${subscription.userID}:`, error.message);
      }
    }
    
    console.log(`✅ Retrieved ${tokens.length} active tokens`);
    return tokens;
    
  } catch (error) {
    console.error("❌ Error fetching tokens:", error);
    return [];
  }
}

// ===== TOKEN-BASED EXECUTION FUNCTIONS =====
/**
 * Process signal with tokens
 */
async function processSignalWithTokens(signalData, tokens) {
  const results = [];
  console.log(`🚀 Processing signal for ${tokens.length} tokens`);
  
  for (const token of tokens) {
    try {
      console.log(`📈 Processing token for ${token.clientName} (${token.brokerType})`);
      const result = await executeTradeWithToken(token, signalData);
      
      results.push({
        tokenId: token.tokenId,
        clientId: token.clientId,
        clientName: token.clientName,
        brokerType: token.brokerType,
        allocatedCapital: token.allocatedCapital,
        success: result.success,
        message: result.message,
        orderId: result.orderId,
        error: result.error,
        simulated: result.simulated || false
      });
      
    } catch (error) {
      console.error(`❌ Error processing token for ${token.clientName}:`, error.message);
      results.push({
        tokenId: token.tokenId,
        clientId: token.clientId,
        clientName: token.clientName,
        brokerType: token.brokerType,
        allocatedCapital: token.allocatedCapital,
        success: false,
        message: `Execution failed: ${error.message}`,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Execute trade with a token
 */
async function executeTradeWithToken(token, signalData) {
  const { brokerType, allocatedCapital } = token;
  
  try {
    switch (brokerType) {
      case 'IIFL':
        return await executeIIFLTrade(token, signalData, allocatedCapital);
      
      default:
        throw new Error(`Unsupported broker type: ${brokerType}`);
    }
  } catch (error) {
    return {
      success: false,
      message: `Trade execution failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * IIFL trade execution with token
 */
async function executeIIFLTrade(token, signalData, capital) {
  try {
    const { placeOrderForUser } = require('./Brokers/IIFL/IIFLUtils');

    // Parse the signal data
    const parsedData = EangelparseMessageText(signalData.messageText);
    if (!parsedData) {
      throw new Error('Unable to parse trading signal');
    }

    const { symbol, price, transactionType, stopLoss } = parsedData;
    const action = transactionType.toUpperCase();

    // Prepare user object with capital from token
    const userWithCapital = {
      ...token.userObject,
      capital: capital,
      subscription: token.subscription
    };

    // Execute trade using existing IIFL logic
    const result = await placeOrderForUser(
      userWithCapital,
      symbol,
      action,
      price,
      stopLoss
    );

    return {
      success: result.success,
      message: result.success ? 'IIFL trade executed successfully' : result.error,
      orderId: result.orderId || `IIFL_${Date.now()}`,
      simulated: result.simulated || false,
      data: result
    };

  } catch (error) {
    return {
      success: false,
      message: `IIFL execution failed: ${error.message}`,
      error: error.message
    };
  }
}

// ===== MAIN ROUTE HANDLER =====
router.post("/", async (req, res) => {
  console.log("=".repeat(80));
  console.log("🚀 EPICRISE TOKEN-BASED EXECUTION - REQUEST RECEIVED");
  console.log("=".repeat(80));
  console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));
  console.log("⏰ Timestamp:", new Date().toISOString());

  try {
    const webhookData = req.body;

    // Generate a hash of the request body to identify duplicates
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(webhookData))
      .digest("hex");

    // Create standard signal data
    const signalData = new StandardSignalData(webhookData);

    console.log("📊 Parsed Signal Data:", signalData);

    // Get all active tokens for Epic Rise strategy
    const tokens = await getActiveTokensForStrategy();

    if (!tokens || tokens.length === 0) {
      console.log("⚠️ No active tokens found for Epic Rise strategy");
      return res.json({
        success: true,
        message: "No active subscriptions found",
        summary: {
          total: 0,
          successful: 0,
          failed: 0
        },
        results: []
      });
    }

    // Process signal with all tokens
    const results = await processSignalWithTokens(signalData, tokens);

    // Prepare response
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log("=".repeat(80));
    console.log("📊 EXECUTION SUMMARY");
    console.log("=".repeat(80));
    console.log(`   ✅ Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   📈 Total: ${results.length}`);

    // Log individual results
    results.forEach(result => {
      if (result.success) {
        const simulatedTag = result.simulated ? " (SIMULATED)" : "";
        console.log(`   ✅ ${result.clientName}: SUCCESS${simulatedTag}`);
      } else {
        console.log(`   ❌ ${result.clientName}: FAILED - ${result.error}`);
      }
    });

    const response = {
      success: true,
      message: "Epic Rise token-based execution completed",
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: results
    };

    console.log("=".repeat(80));
    console.log("✅ EPICRISE TOKEN-BASED EXECUTION COMPLETED");
    console.log("=".repeat(80));

    res.json(response);

  } catch (error) {
    console.error("❌ Error in Epic Rise token-based execution:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
});

module.exports = router;

