const express = require("express")
const router = express.Router()
const prisma = require("../prismaClient")
const axios = require("axios")
const nodemailer = require("nodemailer")

function verifyIntegrationKey(req, res, next) {
  const auth = req.headers["authorization"] || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  const expected = process.env.INTEGRATION_API_KEY || process.env.STRATEGY_SERVICE_API_KEY
  if (!expected || token !== expected) {
    return res.status(401).json({ success: false, error: "Unauthorized" })
  }
  next()
}

function getSubscriptionModel(strategyName) {
  const name = String(strategyName || "").toUpperCase()
  if (name === "EPICRISE") return "epicriseSubscription"
  if (name === "OPTIONTRADE" || name === "NIFTY" || name === "BRAIN_WAVE_NIFTY") return "optionTradeSubscription"
  if (name === "BANKNIFTY" || name === "BRAIN_WAVE_BANK_NIFTY") return "bankNiftySubscription"
  return null
}

router.use(verifyIntegrationKey)

router.post("/broker/register", async (req, res) => {
  try {
    console.log("\n" + "=".repeat(80))
    console.log("📨 BROKER REGISTER REQUEST RECEIVED")
    console.log("=".repeat(80))
    console.log("📥 Request Body:", JSON.stringify(req.body, null, 2))

    const { userId, clientId, clientName, allocatedCapital, strategyName, subscriptionId } = req.body || {}

    console.log("\n🔍 Extracted Parameters:")
    console.log(`   userId: ${userId}`)
    console.log(`   clientId: ${clientId}`)
    console.log(`   clientName: ${clientName}`)
    console.log(`   strategyName: ${strategyName}`)
    console.log(`   allocatedCapital: ${allocatedCapital}`)
    console.log(`   subscriptionId: ${subscriptionId}`)

    if (!userId || !clientId || !clientName || !strategyName) {
      console.log("❌ VALIDATION FAILED: Missing required fields")
      return res.status(400).json({ success: false, error: "Missing required fields" })
    }

    const subModel = getSubscriptionModel(strategyName)
    console.log(`\n📋 Strategy Mapping: ${strategyName} → ${subModel}`)
    if (!subModel) {
      console.log("❌ UNKNOWN STRATEGY")
      return res.status(400).json({ success: false, error: "Unknown strategy" })
    }

    // Step 1: Fetch REAL broker token from BrokerToken table
    console.log("\n📝 Step 1: Fetching REAL broker token...")
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: {
        clientId: clientId,
        isActive: true
      }
    });

    if (!brokerAccount) {
      console.log(`❌ BROKER ACCOUNT NOT FOUND - Cannot register user without broker account`);
      return res.status(400).json({ success: false, error: "Broker account not found" });
    }

    console.log(`   ✅ Found BrokerAccount: ${brokerAccount.id}`);

    const brokerToken = await prisma.brokerToken.findFirst({
      where: {
        brokerAccountId: brokerAccount.id,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!brokerToken) {
      console.log(`❌ NO ACTIVE BROKER TOKEN - Cannot register user without valid token`);
      return res.status(400).json({ success: false, error: "No active broker token found" });
    }

    const realToken = brokerToken.accessToken;
    const tokenValidity = brokerToken.expiresAt;
    console.log(`   ✅ Found REAL broker token (expires: ${tokenValidity})`);

    // Step 2: Verify BrokerAccount exists in main app (no need to create duplicate)
    console.log("\n📝 Step 2: Verifying BrokerAccount in main app...")
    console.log(`   Looking for: userId=${userId}, brokerType=IIFL, clientId=${clientId}`)

    // Note: BrokerAccount is already created in friendly-octo-engine
    // We just verify it exists and log it for debugging
    console.log(`✅ BrokerAccount will be used from main app (friendly-octo-engine)`)
    console.log(`   userId: ${userId}`)
    console.log(`   clientId: ${clientId}`)
    console.log(`   clientName: ${clientName}`)
    console.log(`   allocatedCapital: ${allocatedCapital}`)

    // Step 3: Create/Update Subscription
    console.log(`\n📝 Step 3: Creating/Updating ${subModel} subscription...`)

    const defaults = {
      epicriseSubscription: { capital: Number(allocatedCapital || 0) },
      optionTradeSubscription: { lotSize: 1 },
      bankNiftySubscription: { lotSize: 1 }
    }

    // Store both userId and clientId in customSettings for later lookup
    const baseSettings = { userId, clientId, brokerType: 'IIFL', subscriptionId }
    console.log(`   Custom Settings:`, baseSettings)

    const createData = {
      Epicrise: { userID: userId, enabled: true, capital: defaults.epicriseSubscription.capital, customSettings: baseSettings },
      OptionTrade: { userID: userId, enabled: true, lotSize: defaults.optionTradeSubscription.lotSize, customSettings: baseSettings },
      BankNifty: { userID: userId, enabled: true, lotSize: defaults.bankNiftySubscription.lotSize, customSettings: baseSettings }
    }
    const updateData = {
      Epicrise: { enabled: true, capital: defaults.epicriseSubscription.capital, customSettings: baseSettings },
      OptionTrade: { enabled: true, lotSize: defaults.optionTradeSubscription.lotSize, customSettings: baseSettings },
      BankNifty: { enabled: true, lotSize: defaults.bankNiftySubscription.lotSize, customSettings: baseSettings }
    }

    const key = subModel === "epicriseSubscription" ? "Epicrise" : subModel === "optionTradeSubscription" ? "OptionTrade" : "BankNifty"

    const existing = await prisma[subModel].findFirst({ where: { userID: userId } })
    console.log(`   Existing subscription found: ${existing ? 'YES' : 'NO'}`)

    let subscriptionResult
    if (existing) {
      console.log(`   Updating existing subscription (ID: ${existing.id})`)
      subscriptionResult = await prisma[subModel].update({ where: { id: existing.id }, data: updateData[key] })
    } else {
      console.log(`   Creating new subscription`)
      subscriptionResult = await prisma[subModel].create({ data: createData[key] })
    }

    console.log(`✅ Subscription created/updated:`, {
      id: subscriptionResult.id,
      userID: subscriptionResult.userID,
      enabled: subscriptionResult.enabled,
      customSettings: subscriptionResult.customSettings
    })

    // Final Response
    console.log("\n" + "=".repeat(80))
    console.log("✅ BROKER REGISTER RESPONSE")
    console.log("=".repeat(80))
    const response = { success: true }
    console.log("📤 Response Body:", JSON.stringify(response, null, 2))
    console.log("=".repeat(80) + "\n")

    return res.json(response)
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/configure-strategy", async (req, res) => {
  try {
    const { userId, strategyId, strategyName, brokerClientId, brokerClientName, capitalPerTrade, allocatedCapital, lotSize } = req.body || {}
    if (!userId || !strategyName) return res.status(400).json({ success: false, error: "Missing required fields" })
    const subModel = getSubscriptionModel(strategyName)
    if (!subModel) return res.status(400).json({ success: false, error: "Unknown strategy" })

    const updateData = {}
    const settings = { strategyId, brokerType: 'IIFL', brokerClientId, brokerClientName, capitalPerTrade, allocatedCapital, lotSize }

    if (subModel === "epicriseSubscription") {
      updateData.capital = Number(allocatedCapital || capitalPerTrade || 0)
      console.log(`✅ Configuring Epic Rise for ${userId}: Capital = ₹${updateData.capital}`)
    } else {
      // OptionTrade or BankNifty - use lotSize
      updateData.lotSize = Number(lotSize || 1)
      console.log(`✅ Configuring ${strategyName} for ${userId}: Lot Size = ${updateData.lotSize}`)
    }

    updateData.customSettings = settings

    const result = await prisma[subModel].updateMany({ where: { userID: userId }, data: updateData })
    console.log(`📊 Update result: ${result.count} subscriptions updated`)

    return res.json({ success: true, message: `Strategy configured successfully`, data: { lotSize: updateData.lotSize, capital: updateData.capital } })
  } catch (e) {
    console.error(`❌ Error configuring strategy: ${e.message}`)
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.get("/strategy-config", async (req, res) => {
  try {
    const { userId, strategyId, strategyName } = req.query
    if (!userId || !strategyName) return res.status(400).json({ success: false, error: "Missing required fields" })
    const subModel = getSubscriptionModel(strategyName)
    if (!subModel) return res.status(400).json({ success: false, error: "Unknown strategy" })
    const sub = await prisma[subModel].findFirst({ where: { userID: String(userId), enabled: true } })
    return res.json({ success: true, data: sub })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.delete("/strategy-config", async (req, res) => {
  try {
    const { userId, strategyId, strategyName } = req.query
    if (!userId || !strategyName) return res.status(400).json({ success: false, error: "Missing required fields" })
    const subModel = getSubscriptionModel(strategyName)
    if (!subModel) return res.status(400).json({ success: false, error: "Unknown strategy" })
    await prisma[subModel].updateMany({ where: { userID: String(userId) }, data: { enabled: false } })
    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/strategy/start", async (req, res) => {
  try {
    const { userId, subscriptionId, strategyType, brokerAccounts, configuration } = req.body || {}
    if (!userId || !strategyType) return res.status(400).json({ success: false, error: "Missing required fields" })
    const subModel = getSubscriptionModel(strategyType)
    if (!subModel) return res.status(400).json({ success: false, error: "Unknown strategy" })
    const custom = { subscriptionId, configuration, brokerAccounts }
    await prisma[subModel].updateMany({ where: { userID: userId }, data: { enabled: true, customSettings: custom } })
    return res.json({ success: true, executionId: `${userId}-${Date.now()}` })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/strategy/stop", async (req, res) => {
  try {
    const { userId, subscriptionId } = req.body || {}
    if (!userId) return res.status(400).json({ success: false, error: "Missing required fields" })
    await prisma.epicriseSubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    await prisma.optionTradeSubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    await prisma.bankNiftySubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    return res.json({ success: true, message: "stopped" })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/start", async (req, res) => {
  try {
    const { userId, subscriptionId, strategyType, brokerAccounts, configuration } = req.body || {}
    if (!userId || !strategyType) return res.status(400).json({ success: false, error: "Missing required fields" })
    const subModel = getSubscriptionModel(strategyType)
    if (!subModel) return res.status(400).json({ success: false, error: "Unknown strategy" })
    const custom = { subscriptionId, configuration, brokerAccounts }
    await prisma[subModel].updateMany({ where: { userID: userId }, data: { enabled: true, customSettings: custom } })
    return res.json({ success: true, executionId: `${userId}-${Date.now()}` })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/stop", async (req, res) => {
  try {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ success: false, error: "Missing required fields" })
    await prisma.epicriseSubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    await prisma.optionTradeSubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    await prisma.bankNiftySubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    return res.json({ success: true, message: "stopped" })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/broker/token", async (req, res) => {
  try {
    const { userID, token, tokenValidity, loginStatus, tradingStatus } = req.body || {}
    if (!userID || !token) return res.status(400).json({ success: false, error: "Missing required fields" })
    const existing = await prisma.iIFLUser.findUnique({ where: { userID } })
    if (!existing) {
      return res.status(404).json({ success: false, error: "User not registered" })
    }
    const validityDate = tokenValidity ? new Date(tokenValidity) : new Date(Date.now() + 12 * 60 * 60 * 1000)
    await prisma.iIFLUser.update({ where: { userID }, data: { token, tokenValidity: validityDate, loginStatus: loginStatus || "success", tradingStatus: tradingStatus || "active" } })
    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/tokens/sync", async (req, res) => {
  try {
    const data = req.body || {}
    const userId = data.userId
    const accessToken = data.encryptedToken || data.accessToken
    if (!userId || !accessToken) return res.status(400).json({ success: false, error: "Missing userId or token" })
    let user = await prisma.iIFLUser.findUnique({ where: { userID: userId } })
    if (!user) {
      user = await prisma.iIFLUser.create({ data: {
        userID: userId,
        email: `${userId}@local`,
        phoneNumber: "NA",
        clientName: data.clientName || userId,
        password: "INTEGRATION_MANAGED",
        appKey: "INTEGRATION_MANAGED",
        appSecret: "INTEGRATION_MANAGED",
        totpSecret: "INTEGRATION_MANAGED",
        state: "live",
        loginStatus: "success",
        tradingStatus: "active",
        token: accessToken,
        tokenValidity: new Date(Date.now() + 12 * 60 * 60 * 1000)
      }})
    } else {
      await prisma.iIFLUser.update({ where: { userID: userId }, data: {
        token: accessToken,
        tokenValidity: new Date(Date.now() + 12 * 60 * 60 * 1000),
        loginStatus: "success",
        tradingStatus: "active"
      }})
    }
    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.delete("/tokens/subscription/:subscriptionId", async (req, res) => {
  try {
    const subId = req.params.subscriptionId
    await prisma.epicriseSubscription.updateMany({ where: { customSettings: { path: ["subscriptionId"], equals: subId } }, data: { enabled: false } })
    await prisma.optionTradeSubscription.updateMany({ where: { customSettings: { path: ["subscriptionId"], equals: subId } }, data: { enabled: false } })
    await prisma.bankNiftySubscription.updateMany({ where: { customSettings: { path: ["subscriptionId"], equals: subId } }, data: { enabled: false } })
    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.post("/broker/remove", async (req, res) => {
  try {
    const { userId, brokerType, clientId } = req.body || {}
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" })
    await prisma.epicriseSubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    await prisma.optionTradeSubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    await prisma.bankNiftySubscription.updateMany({ where: { userID: userId }, data: { enabled: false } })
    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

router.get("/users/:userID/token", async (req, res) => {
  try {
    const userID = req.params.userID
    const user = await prisma.iIFLUser.findUnique({ where: { userID } })
    if (!user) return res.status(404).json({ success: false, error: "User not found" })
    const preview = user.token ? String(user.token).substring(0, 16) + '...' : null
    return res.json({ success: true, userID, hasToken: !!user.token, tokenPreview: preview, tokenValidity: user.tokenValidity })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = router
// Start all strategies for a single user (register + configure + start)
router.post("/start-all", async (req, res) => {
  try {
    const { userId, clientId, clientName, capitalPerTrade, lotSizeNifty = 1, lotSizeBank = 1 } = req.body || {}
    if (!userId || !clientId || !clientName) return res.status(400).json({ success: false, error: "Missing required fields" })

    // REAL TRADING ONLY - Verify broker account exists
    console.log("\n📝 /start-all: Verifying broker account...")
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: { clientId: clientId, isActive: true }
    });

    if (!brokerAccount) {
      return res.status(400).json({ success: false, error: "Broker account not found" });
    }

    const brokerToken = await prisma.brokerToken.findFirst({
      where: {
        brokerAccountId: brokerAccount.id,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!brokerToken) {
      return res.status(400).json({ success: false, error: "No active broker token found" });
    }

    console.log(`✅ Broker account verified with REAL token (expires: ${brokerToken.expiresAt})`);
    // No need to create IIFLUser - subscriptionManager will use BrokerAccount directly

    // Configure
    {
      const subEpic = await prisma.epicriseSubscription.findFirst({ where: { userID: userId } })
      if (subEpic) {
        await prisma.epicriseSubscription.update({ where: { id: subEpic.id }, data: { enabled: true, capital: Number(capitalPerTrade || 0), customSettings: { clientId, brokerType: 'IIFL' } } })
      } else {
        await prisma.epicriseSubscription.create({ data: { userID: userId, enabled: true, capital: Number(capitalPerTrade || 0), customSettings: { clientId, brokerType: 'IIFL' } } })
      }
      const subNifty = await prisma.optionTradeSubscription.findFirst({ where: { userID: userId } })
      if (subNifty) {
        await prisma.optionTradeSubscription.update({ where: { id: subNifty.id }, data: { enabled: true, lotSize: Number(lotSizeNifty || 1), customSettings: { clientId, brokerType: 'IIFL' } } })
      } else {
        await prisma.optionTradeSubscription.create({ data: { userID: userId, enabled: true, lotSize: Number(lotSizeNifty || 1), customSettings: { clientId, brokerType: 'IIFL' } } })
      }
      const subBank = await prisma.bankNiftySubscription.findFirst({ where: { userID: userId } })
      if (subBank) {
        await prisma.bankNiftySubscription.update({ where: { id: subBank.id }, data: { enabled: true, lotSize: Number(lotSizeBank || 1), customSettings: { clientId, brokerType: 'IIFL' } } })
      } else {
        await prisma.bankNiftySubscription.create({ data: { userID: userId, enabled: true, lotSize: Number(lotSizeBank || 1), customSettings: { clientId, brokerType: 'IIFL' } } })
      }
    }

    // Token sync if provided
    if (token) {
      const validityDate = new Date(Date.now() + 12 * 60 * 60 * 1000)
      await prisma.iIFLUser.update({ where: { userID: userId }, data: { token, tokenValidity: validityDate, loginStatus: "success", tradingStatus: "active" } })
    }

    // Enable all
    await prisma.epicriseSubscription.updateMany({ where: { userID: userId }, data: { enabled: true } })
    await prisma.optionTradeSubscription.updateMany({ where: { userID: userId }, data: { enabled: true } })
    await prisma.bankNiftySubscription.updateMany({ where: { userID: userId }, data: { enabled: true } })

    return res.json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

// Health check for a user's strategy execution prerequisites
router.get("/health/:userId", async (req, res) => {
  try {
    const userId = req.params.userId
    const user = await prisma.iIFLUser.findUnique({ where: { userID: userId } })
    const epic = await prisma.epicriseSubscription.findFirst({ where: { userID: userId } })
    const nifty = await prisma.optionTradeSubscription.findFirst({ where: { userID: userId } })
    const bank = await prisma.bankNiftySubscription.findFirst({ where: { userID: userId } })

    const now = Date.now()
    const tokenValid = !!(user?.token && user?.tokenValidity && new Date(user.tokenValidity).getTime() > now)
    const details = {
      tokenPresent: !!user?.token,
      tokenValid,
      epicrise: { enabled: !!epic?.enabled, capital: epic?.capital || 0 },
      optiontrade: { enabled: !!nifty?.enabled, lotSize: nifty?.lotSize || 0 },
      banknifty: { enabled: !!bank?.enabled, lotSize: bank?.lotSize || 0 }
    }
    const ok = tokenValid && (!!epic?.enabled || !!nifty?.enabled || !!bank?.enabled)
    if (!ok) {
      try {
        const webhook = process.env.SLACK_WEBHOOK_URL
        if (webhook) {
          await axios.post(webhook, { text: `⚠️ Strategy health failed for ${userId}: ${JSON.stringify(details)}` })
        }
        const host = process.env.EMAIL_HOST, port = parseInt(process.env.EMAIL_PORT || '0', 10), user = process.env.EMAIL_USER, pass = process.env.EMAIL_PASS
        const to = process.env.ALERT_EMAIL_TO || user
        if (host && port && user && pass && to) {
          const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
          await transporter.sendMail({ from: user, to, subject: `Strategy Health Alert for ${userId}`, text: `Health failed:\n${JSON.stringify(details, null, 2)}` })
        }
      } catch (notifyErr) {
        console.warn('Notify error:', notifyErr.message)
      }
    }
    return res.json({ success: ok, details })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
})

// 🔐 Token Refresh Endpoints
router.post("/tokens/refresh-all", async (req, res) => {
  try {
    console.log("🔐 Manual token refresh initiated for all users");

    const users = await prisma.iIFLUser.findMany({
      where: {
        state: "live",
        password: { not: "INTEGRATION_MANAGED" }
      }
    });

    if (!users || users.length === 0) {
      return res.json({ success: true, message: "No real users to refresh", refreshed: 0 });
    }

    console.log(`📊 Found ${users.length} real users to refresh`);

    const { loginWithCredentials } = require("../Strategies/Epicrise/Brokers/IIFL/loginUtils");
    const results = [];

    for (const userData of users) {
      try {
        const userCredentials = {
          userID: userData.userID,
          password: userData.password,
          appKey: userData.appKey,
          appSecret: userData.appSecret,
          totpSecret: userData.totpSecret
        };

        const loginResult = await loginWithCredentials(userCredentials);

        if (loginResult && loginResult.success && loginResult.accessToken) {
          const token = loginResult.accessToken;
          const tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000);

          await prisma.iIFLUser.update({
            where: { userID: userData.userID },
            data: {
              token,
              tokenValidity,
              lastLoginTime: new Date(),
              loginStatus: "success",
              tradingStatus: "active"
            }
          });

          console.log(`✅ Token refreshed for ${userData.clientName}`);
          results.push({ success: true, userID: userData.userID, clientName: userData.clientName });
        } else {
          throw new Error(loginResult?.error || "Unknown error");
        }
      } catch (error) {
        console.error(`❌ Failed to refresh token for ${userData.clientName}:`, error.message);
        results.push({ success: false, userID: userData.userID, error: error.message });
      }

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return res.json({
      success: true,
      message: "Token refresh completed",
      refreshed: successful,
      failed: failed,
      total: results.length,
      results
    });
  } catch (e) {
    console.error("Error refreshing tokens:", e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/tokens/refresh/:userID", async (req, res) => {
  try {
    const { userID } = req.params;

    console.log(`🔐 Manual token refresh initiated for user: ${userID}`);

    const user = await prisma.iIFLUser.findUnique({ where: { userID } });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.password === "INTEGRATION_MANAGED") {
      return res.json({ success: false, message: "Cannot refresh token for integration-managed user" });
    }

    const { loginWithCredentials } = require("../Strategies/Epicrise/Brokers/IIFL/loginUtils");

    const userCredentials = {
      userID: user.userID,
      password: user.password,
      appKey: user.appKey,
      appSecret: user.appSecret,
      totpSecret: user.totpSecret
    };

    const loginResult = await loginWithCredentials(userCredentials);

    if (loginResult && loginResult.success && loginResult.accessToken) {
      const token = loginResult.accessToken;
      const tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000);

      await prisma.iIFLUser.update({
        where: { userID },
        data: {
          token,
          tokenValidity,
          lastLoginTime: new Date(),
          loginStatus: "success",
          tradingStatus: "active"
        }
      });

      console.log(`✅ Token refreshed for ${user.clientName}`);
      return res.json({
        success: true,
        message: `Token refreshed for ${user.clientName}`,
        userID,
        clientName: user.clientName,
        tokenValidity
      });
    } else {
      throw new Error(loginResult?.error || "Login failed");
    }
  } catch (e) {
    console.error("Error refreshing token:", e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router