const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const MotilalRouter = require("./Brokers/MotilalOswal/Motilal.js");
const AngelRouter = require("./Brokers/AngelOne/Angel.js");
const DhanRouter = require("./Brokers/Dhan/Dhan.js");
const ShareKhanRouter = require("./Brokers/ShareKhan/ShareKhan.js");
const IIFLRouter = require("./Brokers/IIFL/IIFL");
const TelegramRouter = require("./Utils/telegram.js");

const {
  createFakeResponse,
  CmiparseMessageText,
  sendMessageToTelegram,
} = require("./Utils/utilities.js");

const CONFIG = require("./Utils/config.js");

const forwardRequest = (req, webhookData, url) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Forwarding request to ${url}`);

      // Create a fake request to internally forward the webhook
      const fakeReq = { ...req, url, method: "POST", body: webhookData };
      const fakeRes = createFakeResponse(resolve);

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout forwarding to ${url}`));
      }, 15000); // 15seconds timeout (increased for Telegram)

      req.app.handle(fakeReq, fakeRes, () => {
        clearTimeout(timeout);
        resolve({ success: true });
      });
    } catch (error) {
      reject(new Error(`Error forwarding to ${url}: ${error.message}`));
    }
  });
};

router.post("/", async (req, res) => {
  console.log("\n" + "=".repeat(80));
  console.log("📥 CMI WEBHOOK RECEIVED");
  console.log("=".repeat(80));
  console.log("📋 Request Body Type:", typeof req.body);
  console.log("📋 Request Body:", JSON.stringify(req.body, null, 2));
  console.log("=".repeat(80));

  try {
    const webhookData = req.body;

    // Forward the request to all broker routes
    console.log("\n🚀 FORWARDING CMI REQUEST TO ALL BROKERS");
    console.log("=".repeat(60));

    // Define active broker routes (only include brokers that are actually being called)
    const activeBrokerRoutes = [
      { name: "MOTILAL OSWAL", url: "/CMI/MotilalOswal" },
      { name: "ANGEL ONE", url: "/CMI/AngelOne" },
      { name: "DHAN", url: "/CMI/Dhan" },
      // { name: "SHAREKHAN", url: "/CMI/ShareKhan" }, // Commented out - not active
      { name: "IIFL", url: "/CMI/IIFL" },
      { name: "TELEGRAM", url: "/CMI/Telegram" }
    ];

    console.log("📋 Active Broker Routes to Process:");
    activeBrokerRoutes.forEach((broker, index) => {
      console.log(`   ${index + 1}. ${broker.name} -> ${broker.url}`);
    });

    const results = await Promise.allSettled([
      forwardRequest(req, webhookData, "/CMI/MotilalOswal"),
      forwardRequest(req, webhookData, "/CMI/AngelOne"),
      forwardRequest(req, webhookData, "/CMI/Dhan"),
      // forwardRequest(req, webhookData, "/CMI/ShareKhan"), // Commented out - not active
      forwardRequest(req, webhookData, "/CMI/IIFL"),
      forwardRequest(req, webhookData, "/CMI/Telegram"),
    ]);

    console.log("📊 BROKER RESPONSE SUMMARY");
    console.log("=".repeat(60));

    // Validate that arrays are aligned to prevent undefined access errors
    if (results.length !== activeBrokerRoutes.length) {
      console.error(`⚠️ ARRAY MISMATCH: ${results.length} results vs ${activeBrokerRoutes.length} broker routes`);
      console.error("This could cause undefined access errors. Please check the broker configuration.");
    }

    // Log detailed results for each broker
    results.forEach((result, index) => {
      const broker = activeBrokerRoutes[index];
      if (!broker) {
        console.error(`⚠️ No broker found for index ${index}. This indicates an array mismatch.`);
        return;
      }

      if (result.status === "fulfilled") {
        console.log(`✅ ${broker.name}: SUCCESS`);
        if (result.value && typeof result.value === 'object') {
          console.log(`   📊 Response:`, JSON.stringify(result.value, null, 2));
        }
      } else {
        console.log(`❌ ${broker.name}: FAILED`);
        console.log(`   🔍 Reason: ${result.reason?.message || result.reason}`);
        if (result.reason?.stack) {
          console.log(`   📚 Stack: ${result.reason.stack}`);
        }
      }
    });

    // Check for failures
    const failedRequests = results.filter(
      (result) => result.status === "rejected"
    );

    const successfulRequests = results.filter(
      (result) => result.status === "fulfilled"
    );

    console.log("=".repeat(60));
    console.log(`📊 FINAL SUMMARY: ${successfulRequests.length}/${results.length} brokers succeeded`);
    console.log("=".repeat(60));

    if (failedRequests.length > 0) {
      console.error("⚠️ SOME BROKER REQUESTS FAILED:");
      failedRequests.forEach((result, index) => {
        const failedBrokerIndex = results.findIndex(r => r === result);
        const broker = activeBrokerRoutes[failedBrokerIndex];
        console.error(`   ❌ ${broker?.name || 'Unknown'}: ${result.reason?.message || 'Unknown error'}`);
      });

      return res.status(500).json({
        error: "Failed to forward some requests",
        summary: {
          total: results.length,
          successful: successfulRequests.length,
          failed: failedRequests.length
        },
        details: failedRequests.map((result, index) => {
          const failedBrokerIndex = results.findIndex(r => r === result);
          const broker = activeBrokerRoutes[failedBrokerIndex];
          return {
            broker: broker?.name || 'Unknown',
            status: result.status,
            reason: result.reason ? result.reason.message : "Unknown error",
          };
        }),
      });
    }

    const responseData = {
      message: "CMI Webhook received and forwarded successfully",
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        successful: successfulRequests.length,
        failed: failedRequests.length
      },
      brokers: activeBrokerRoutes.map((broker, index) => ({
        name: broker.name,
        status: results[index]?.status === "fulfilled" ? "SUCCESS" : "FAILED"
      }))
    };

    console.log("📤 SENDING SUCCESS RESPONSE:");
    console.log(JSON.stringify(responseData, null, 2));
    console.log("=".repeat(80));

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error forwarding CMI webhook:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to forward CMI webhook" });
    }
  }
});

// Attach child routes
router.use("/MotilalOswal", MotilalRouter);
router.use("/AngelOne", AngelRouter);
router.use("/Dhan", DhanRouter);
router.use("/ShareKhan", ShareKhanRouter);
router.use("/IIFL", IIFLRouter);
router.use("/Telegram", TelegramRouter);

module.exports = router;
