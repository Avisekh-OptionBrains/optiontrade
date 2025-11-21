const express = require("express");
const cookieParser = require("cookie-parser");
const schedule = require("node-schedule");
const path = require("path");
const http = require("http");
require('dotenv').config();
const tickerRouter = require("./tickerRouter");

const EpicriseRouter = require("./Strategies/Epicrise/epicRise");
const OptionTradeRouter = require("./Strategies/OptionTrade");
const BankNiftyRouter = require("./Strategies/BankNifty");
const orderResponsesRouter = require("./routes/orderResponses");
const dashboardRouter = require("./routes/dashboard");
const enhancedDashboardRouter = require("./routes/enhanced-dashboard");
const usersRouter = require("./routes/users");
const apiRouter = require("./routes/api");
const integrationRouter = require("./routes/integration");
const authRouter = require("./routes/auth");
const { verifyAuth, logout } = require("./middleware/authMiddleware");
const WebSocketManager = require("./websocket-server");

const fs = require("fs");

const { initializeDatabaseConnection } = require("./newdb");
const IIFLUser = require("./models/IIFLUser");

initializeDatabaseConnection();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize WebSocket Manager
const wsManager = new WebSocketManager(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.text());

// Make WebSocket manager available globally
global.wsManager = wsManager;

// Serve static files (login page is public, others will be protected)
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`Request to ${req.url} took ${duration}ms`);
  });
  next();
});

app.use((req, res, next) => {
  console.log(`Received ${req.method} request at ${req.url}`);
  next();
});

// Authentication routes (public - no auth required)
app.use("/api/auth", authRouter);
app.post("/api/auth/logout", logout);

// Middleware to protect HTML pages (except login.html)
app.use((req, res, next) => {
  // Allow public access to login page and auth APIs
  if (req.path === '/login.html' ||
      req.path === '/login.js' ||
      req.path.startsWith('/api/auth/') ||
      req.path.startsWith('/assets/')) {
    return next();
  }

  // For HTML pages, check authentication
  if (req.path.endsWith('.html')) {
    const token = req.cookies?.authToken;
    if (!token) {
      return res.redirect('/login.html');
    }
  }

  next();
});
//////////////// credentials ////////////////


app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }
  next();
});

// Middleware to handle different content types
// Duplicate parsers removed


// IIFL Login Function - Generate Session Tokens for all IIFL clients
async function loginToIIFLForAllClients() {
  try {
    console.log("🔐 Starting IIFL login process for all clients...");

    // Fetch all IIFL users from the database
    const users = await IIFLUser.find();

    if (!users || users.length === 0) {
      console.log("⚠️ No IIFL users found in database");
      return;
    }

    console.log(`📊 Found ${users.length} IIFL users to process`);

    // Process each user
    for (const userData of users) {
      const { userID, appKey, appSecret, clientName } = userData;

      console.log(`🔄 Processing IIFL login for: ${clientName} (${userID})`);

      try {
        // Use the dynamic IIFL login with user's credentials
        const { loginWithCredentials } = require("./Strategies/Epicrise/Brokers/IIFL/loginUtils");

        console.log(`📡 Attempting IIFL login for ${userID} using advanced OAuth flow...`);
        console.log(`🔑 Using appKey: ${appKey.substring(0, 10)}...`);
        console.log(`🔐 TOTP Secret: ${userData.totpSecret ? "PROVIDED" : "MISSING"}`);

        // Prepare user credentials
        const userCredentials = {
          userID: userData.userID,
          password: userData.password,
          appKey: userData.appKey,
          appSecret: userData.appSecret,
          totpSecret: userData.totpSecret
        };

        const loginResult = await loginWithCredentials(userCredentials);

        // Extract token from login result
        if (loginResult && loginResult.success && loginResult.accessToken) {
          const token = loginResult.accessToken;

          // Update user record with new token
          userData.token = token;
          userData.tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours validity
          userData.lastLoginTime = new Date();
          userData.loginStatus = "success";
          userData.tradingStatus = "active";

          await userData.save();

          console.log(`✅ IIFL token stored successfully for ${userID}`);
          console.log(`   🔑 Token: ${token.substring(0, 20)}...`);
          console.log(`   📅 Valid until: ${userData.tokenValidity}`);
        } else {
          throw new Error(`IIFL login failed: ${loginResult?.error || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`❌ Error during IIFL login for ${userID}:`, error.response?.data || error.message);

        // Update user record with failed status
        userData.loginStatus = "failed";
        userData.tradingStatus = "inactive";
        userData.lastLoginTime = new Date();
        await userData.save();
      }

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("🎉 IIFL login process completed for all clients");

  } catch (error) {
    console.error("💥 Error in IIFL login process:", error);
  }
}

app.post("/addIIFLuser", async (req, res) => {
  try {
    console.log("🔍 IIFL user creation request received");
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));

    const userData = req.body;

    // Validate required fields for IIFL
    const { email, phoneNumber, clientName, userID, password, appKey, appSecret, totpSecret, capital, accessToken } = userData;
    console.log("🔍 Extracted fields:", {
      email, phoneNumber, clientName, userID,
      password: password ? "PROVIDED" : "MISSING",
      appKey: appKey ? "PROVIDED" : "MISSING",
      appSecret: appSecret ? "PROVIDED" : "MISSING",
      totpSecret: totpSecret ? "PROVIDED" : "MISSING",
      capital,
      accessToken: accessToken ? "PROVIDED" : "NOT_PROVIDED"
    });

    if (!email || !phoneNumber || !clientName || !userID || !password || !appKey || !appSecret || !totpSecret || !capital) {
      console.log("❌ Validation failed - missing required fields");
      console.log("Missing fields:", {
        email: !email ? "MISSING" : "OK",
        phoneNumber: !phoneNumber ? "MISSING" : "OK",
        clientName: !clientName ? "MISSING" : "OK",
        userID: !userID ? "MISSING" : "OK",
        password: !password ? "MISSING" : "OK",
        appKey: !appKey ? "MISSING" : "OK",
        appSecret: !appSecret ? "MISSING" : "OK",
        totpSecret: !totpSecret ? "MISSING" : "OK",
        capital: !capital ? "MISSING" : "OK"
      });
      return res.status(400).json({ error: "All required fields must be filled (email, phoneNumber, clientName, userID, password, appKey, appSecret, totpSecret, capital)" });
    }

    console.log("✅ All required fields present, proceeding with user creation");

    // Set initial status
    userData.loginStatus = accessToken ? "success" : "pending";
    userData.tradingStatus = accessToken ? "active" : "inactive";

    // If access token is provided, store it
    if (accessToken) {
      userData.token = accessToken;
      userData.tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours validity
      userData.lastLoginTime = new Date();
      console.log("✅ Access token provided manually - user ready for trading");
    } else {
      console.log("⚠️ No access token provided - OAuth login required");
    }

    console.log("💾 Creating new IIFL user with data:", JSON.stringify(userData, null, 2));
    const newUser = new IIFLUser(userData);
    await newUser.save();

    console.log(`✅ IIFL user added successfully: ${clientName} (${userID})`);
    res.json({ message: "IIFL user added successfully! Session tokens will be generated during next scheduled login." });
  } catch (error) {
    console.error("❌ Error adding IIFL user:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to add IIFL user." });
  }
});

// Execute the async function

// async function performLoginForAllUsers() {
//   const credentials = await getCredentials();
//   const { macAddress, localIp, publicIp } = credentials;

//   try {
//     console.log("Fetching all users from the Angeluser collection...");
//     // Fetch all users from the Angeluser collection
//     const users = await Angeluser.find({});
//     console.log(`Fetched ${users.length} users`);

//     if (!users.length) {
//       throw new Error("No users found in the Angeluser collection");
//     }

//     // To collect responses from each user
//     const results = [];

//     // Iterate through each user and perform the login
//     for (const user of users) {
//       try {
//         // console.log(`Processing user: ${user.userId}`);

//         // Generate TOTP for the user and extract only the OTP value
//         // console.log(`Generating TOTP for user: ${user.userId}`);
//         const otp = TOTP.generate(user.totpKey).otp; // Only get the OTP part
//         // console.log(`Generated TOTP: ${otp}`);

//         // Prepare the request payload for the login
//         const data = {
//           clientcode: user.userId,
//           password: user.password,
//           totp: otp, // Only push the OTP value
//         };

//         // Log the payload before making the request
//         // console.log("Login request payload:", data);

//         // Configure the request
//         const config = {
//           method: "post",
//           url: "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
//           headers: {
//             "Content-Type": "application/json",
//             Accept: "application/json",
//             "X-UserType": "USER",
//             "X-SourceID": "WEB",
//             "X-ClientLocalIP": localIp,
//             "X-ClientPublicIP": publicIp,
//             "X-MACAddress": macAddress,
//             "X-PrivateKey": user.apiKey,
//           },
//           data: data,
//         };

//         // Log the full request configuration
//         // console.log("Request configuration:", config);

//         // Send the login request
//         const response = await axios(config);
//         console.log(`Login successful for user: ${user.userId}`);

//         // Check if the response has the expected structure
//         if (response.data && response.data.data) {
//           const { jwtToken, refreshToken, feedToken } = response.data.data;

//           // Log the tokens to verify extraction
//           // console.log("Extracted Tokens:", {
//           //   jwtToken,
//           //   refreshToken,
//           //   feedToken,
//           // });

//           // Update the user record with the tokens
//           await Angeluser.updateOne(
//             { userId: user.userId },
//             {
//               $set: {
//                 jwtToken: jwtToken,
//                 refreshToken: refreshToken,
//                 feedToken: feedToken,
//               },
//             }
//           );

//           // Collect the result for this user
//           results.push({
//             userId: user.userId,
//             status: "success",
//             response: response.data,
//           });
//         } else {
//           console.error(`No token data found for user: ${user.userId}`);
//           results.push({
//             userId: user.userId,
//             status: "failed",
//             error: "Token data missing in response",
//           });
//         }
//       } catch (innerError) {
//         console.error(
//           `Login failed for user: ${user.userId}`,
//           innerError.message
//         );
//         results.push({
//           userId: user.userId,
//           status: "failed",
//           error: innerError.message,
//         });
//       }
//     }

//     // Return the consolidated results after processing all users
//     console.log("Login process completed for all users.");
//     return results;
//   } catch (error) {
//     console.error("Error performing login:", error.message);
//     throw new Error("Internal server error");
//   }
// }

// schedule.scheduleJob("00 21 * * *", async () => {
//   console.log("Scheduled task triggered at 9:00 am");
//   await performLoginForAllUsers();
// });

// IIFL login cron job - runs at 3:00 AM daily
if (process.env.ENABLE_LOCAL_IIFL_LOGIN === "true") {
  schedule.scheduleJob("00 3 * * *", async () => {
    console.log("IIFL scheduled login task triggered at 3:00 AM");
    await loginToIIFLForAllClients();
  });
}

// Integration Routes (Protected with Integration API Key - NO verifyAuth middleware)
app.use("/api/integration", integrationRouter);
app.use("/api/strategy", integrationRouter);

// API Routes (Protected with authentication)
app.use("/api/subscriptions", verifyAuth, apiRouter); // New subscription management API
app.use("/api/order-responses", verifyAuth, orderResponsesRouter);
app.use("/api/dashboard", verifyAuth, dashboardRouter);
app.use("/api/enhanced-dashboard", verifyAuth, enhancedDashboardRouter);
app.use("/api/users", verifyAuth, usersRouter);

// Strategy Routes (Webhook routes - NO authentication required for TradingView webhooks)
app.use("/Epicrise", EpicriseRouter);
app.use("/OptionTrade", OptionTradeRouter);
app.use("/BankNifty", BankNiftyRouter);

// Manual trigger endpoints for testing
app.post("/api/trigger-iifl-login", async (req, res) => {
  try {
    console.log("🔄 Manual IIFL login trigger initiated");
    await loginToIIFLForAllClients();
    res.json({ success: true, message: "IIFL login process completed" });
  } catch (error) {
    console.error("Error in manual IIFL login:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual IIFL token update endpoint for testing
app.post("/api/iifl/update-token", async (req, res) => {
  try {
    const { userID, token } = req.body;

    if (!userID || !token) {
      return res.status(400).json({ error: "userID and token are required" });
    }

    const user = await IIFLUser.findOne({ userID: userID });
    if (!user) {
      return res.status(404).json({ error: "IIFL user not found" });
    }

    user.token = token;
    user.tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
    user.lastLoginTime = new Date();
    user.loginStatus = "success";
    user.tradingStatus = "active";

    await user.save();

    console.log(`✅ IIFL token updated manually for ${userID}`);
    res.json({
      success: true,
      message: `Token updated successfully for ${user.clientName}`,
      tokenPreview: token.substring(0, 20) + "..."
    });
  } catch (error) {
    console.error("Error updating IIFL token:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test IIFL login for specific user
app.post("/api/iifl/test-login", async (req, res) => {
  try {
    const { userID } = req.body;

    if (!userID) {
      return res.status(400).json({ error: "userID is required" });
    }

    const user = await IIFLUser.findOne({ userID: userID });
    if (!user) {
      return res.status(404).json({ error: "IIFL user not found" });
    }

    console.log(`🧪 Testing IIFL login for ${user.clientName} (${userID})`);

    // Use the dynamic IIFL login with user's credentials
    const { loginWithCredentials } = require("./Strategies/Epicrise/Brokers/IIFL/loginUtils");

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

      // Update user record with new token
      user.token = token;
      user.tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000);
      user.lastLoginTime = new Date();
      user.loginStatus = "success";
      user.tradingStatus = "active";

      await user.save();

      console.log(`✅ IIFL test login successful for ${userID}`);
      res.json({
        success: true,
        message: `Login successful for ${user.clientName}`,
        tokenPreview: token.substring(0, 20) + "...",
        tokenValidity: user.tokenValidity
      });
    } else {
      console.log(`❌ IIFL test login failed for ${userID}: ${loginResult?.error}`);
      res.status(400).json({
        success: false,
        error: loginResult?.error || 'Login failed'
      });
    }
  } catch (error) {
    console.error("Error testing IIFL login:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// (async () => {
//   console.log("Motilal client login task trigger");
//   await loginToMotilalOswalForAllClients();
// })();

// (async () => {
//   console.log("iifl client login task trigger");
//   await loginToIIFLForAllClients();
// })();

// (async () => {
//   console.log("Angel client login task trigger");
//   await performLoginForAllUsers();
// })();
// Uncomment to test ShareKhan login on startup
// (async () => {
//   console.log("ShareKhan client login task trigger");
//   await loginToShareKhanForAllClients();
// })();

server.listen(PORT, () => {
  console.log(`🚀 Epicrise Trading Platform is running on http://localhost:${PORT}`);
  console.log(`📊 Enhanced Dashboard: http://localhost:${PORT}/enhanced-dashboard.html`);
  console.log(`🔌 WebSocket Server: ws://localhost:${PORT}/ws`);
  console.log(`📈 API Endpoints: http://localhost:${PORT}/api/`);
});

///////// FEW MORE CHANGES PUSHED
