const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const schedule = require("node-schedule");
const path = require("path");
const http = require("http");
const Order = require("./models/orderModel"); // Adjust the path based on where you saved the model
const tickerRouter = require("./tickerRouter");

const EpicriseRouter = require("./Strategies/Epicrise/epicRise");
const CMIRouter = require("./Strategies/CMI/cmi");
const OptionTradeRouter = require("./Strategies/OptionTrade");
const BankNiftyRouter = require("./Strategies/BankNifty");
const orderResponsesRouter = require("./routes/orderResponses");
const dashboardRouter = require("./routes/dashboard");
const enhancedDashboardRouter = require("./routes/enhanced-dashboard");
const usersRouter = require("./routes/users");
const apiRouter = require("./routes/api");
const authRouter = require("./routes/auth");
const { verifyAuth, logout } = require("./middleware/authMiddleware");
const WebSocketManager = require("./websocket-server");

// const puppeteer = require("puppeteer");
const fs = require("fs");
// const FormData = require("form-data");
const OrderparsedMessage = require("./models/order");

const {
  initializeDatabaseConnection,
  findSymbolInDatabase,
  main,
} = require("./newdb");
const crypto = require("crypto");
const Angeluser = require("./models/Angeluser");
const MOUser = require("./models/MOUser");
const DhanUser = require("./models/DhanUser");
const ShareKhanUser = require("./models/ShareKhanUser");
const IIFLUser = require("./models/IIFLUser");
const { getNetworkCredentials } = require("./utils/networkInfo");
const { TOTP } = require("totp-generator");

initializeDatabaseConnection();

main().catch(console.error);

// main.js

// anotherFile.js
// getCredentials already imported above for ShareKhan

const CONFIG = require("./config"); // Import your config file

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Initialize WebSocket Manager
const wsManager = new WebSocketManager(server);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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

const Client = require("./models/client");
const { env } = require("process");

// initializeDatabaseConnection();

// const macAddress = getMacAddress();

// Login route to authenticate user
app.post("/login", async (req, res) => {
  const { apiKey, clientCode, password, totp, localIP, publicIP, macAddress } =
    req.body;

  const data = {
    clientcode: clientCode,
    password: password,
    totp: totp,
  };

  const config = {
    method: "post",
    url: "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
    data: data,
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

// app.use("/ticker", tickerRouter);
// Get profile route
app.get("/getProfile", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;

  if (!jwtToken || !macAddress || !apiKey) {
    console.error("Missing required cookies.");
    return res
      .status(401)
      .json({ error: "Unauthorized: Required cookies are missing" });
  }

  const config = {
    method: "get",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getProfile",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP":
        req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      "X-ClientPublicIP":
        req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Get order book route
app.get("/getOrderBook", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const config = {
    method: "get",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getOrderBook",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/getPosition", async (req, res) => {
  // Get the necessary values from the request cookies (or set defaults for testing)
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  // Check for required values
  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  // Config for making the API call
  const config = {
    method: "get",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getPosition", // The URL you want to request
    headers: {
      Authorization: `Bearer ${jwtToken}`, // Bearer token
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP, // Use the local IP from cookies
      "X-ClientPublicIP": publicIP, // Use the public IP from cookies
      "X-MACAddress": macAddress, // Use the MAC address from cookies
      "X-PrivateKey": apiKey, // Use the API key from cookies
    },
  };

  try {
    // Make the API call
    const response = await axios(config);
    // Send the response data back to the client
    res.json(response.data);
  } catch (error) {
    // Handle errors if the request fails
    res.status(500).json({ error: error.message });
  }
});

// Cancel order route
app.post("/cancelOrder", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const { variety = "NORMAL", orderid = "201020000000080" } = req.body;
  const data = JSON.stringify({ variety, orderid });

  const config = {
    method: "post",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/cancelOrder",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
    data: data,
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modify order route
app.post("/modifyOrder", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const {
    variety = "NORMAL",
    orderid = "201020000000080",
    ordertype = "LIMIT",
    producttype = "INTRADAY",
    duration = "DAY",
    price = "194.00",
    quantity = "1",
  } = req.body;
  const data = JSON.stringify({
    variety,
    orderid,
    ordertype,
    producttype,
    duration,
    price,
    quantity,
  });

  const config = {
    method: "post",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/modifyOrder",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
    data: data,
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get LTP data route
app.post("/getLtpData", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const {
    exchange = "NSE",
    tradingsymbol = "SBIN-EQ",
    symboltoken = "3045",
  } = req.body;
  const data = JSON.stringify({ exchange, tradingsymbol, symboltoken });

  const config = {
    method: "post",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getLtpData",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
    data: data,
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trade book route
app.get("/getTradeBook", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const config = {
    method: "get",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getTradeBook",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
  };

  try {
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/place-order", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP; // Assuming data is sent in the request body

  // Define the data to be sent to the external API
  const data = JSON.stringify({
    exchange: "NSE",
    tradingsymbol: orderData.tradingsymbol,
    quantity: orderData.quantity,
    disclosedquantity: orderData.disclosedquantity,
    transactiontype: orderData.transactiontype,
    ordertype: orderData.ordertype,
    variety: "NORMAL",
    producttype: "INTRADAY",
  });

  // Define the configuration for the API request
  const config = {
    method: "post",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/placeOrder",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
    data: data,
  };

  try {
    // Make the API request to AngelBroking API
    const response = await axios(config);
    res.json(response.data); // Send the response from the external API back to the client
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place the order" }); // Handle errors appropriately
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }
  next();
});

// Middleware to handle different content types
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

function EangelparseMessageText(messageText) {
  const regex = /ER (Buy|Sell) (\w+) at (\d+(\.\d+)?)/; // Modified regex to also capture price and transaction type
  const match = messageText.match(regex);
  if (match) {
    return {
      transactionType: match[1], // Capture the transaction type (Buy/Sell)
      symbol: match[2], // Capture the symbol
      price: parseFloat(match[3]), // Capture the price
    };
  }
  return null;
}
async function sendMessageToTelegram(botToken, channelId, messageText) {
  try {
    if (!botToken || !channelId) {
      console.error(
        "Error: Missing Telegram credentials - botToken or channelId is not provided."
      );
      return { ok: false, error: "Missing Telegram credentials" };
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: channelId,
        text: messageText,
        parse_mode: "Markdown",
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Telegram API error:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to send message to Telegram");
  }
}

app.get("/getRMS", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const config = {
    method: "get",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getRMS",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
  };

  try {
    const response = await axios(config);
    res.json(response.data); // Send response data back to the client
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching data" });
  }
});

app.get("/nseIntraday", async (req, res) => {
  const jwtToken = req.cookies?.jwtToken;
  const macAddress = req.cookies?.macAddress;
  const apiKey = req.cookies?.apiKey;
  const localIP = req.cookies?.localIP;
  const publicIP = req.cookies?.publicIP;

  if (!jwtToken || !localIP || !publicIP || !macAddress || !apiKey) {
    return res.status(400).json({ error: "Missing required cookie values" });
  }

  const config = {
    method: "get",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/marketData/v1/nseIntraday",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": localIP,
      "X-ClientPublicIP": publicIP,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    },
  };

  try {
    const response = await axios(config);
    res.json(response.data); // Return the data to the client
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch NSE intraday data" });
  }
});

// Route to add client data
app.post("/add-client", async (req, res) => {
  const { clientId, jwtToken, apiKey, capital } = req.body;

  if (!clientId || !jwtToken || !apiKey || !capital) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const newClient = new Client({
      clientId,
      jwtToken,
      apiKey,
      capital,
    });

    await newClient.save();
    res.status(201).json({ message: "Client data added successfully." });
  } catch (error) {
    console.error("Error adding client data:", error);
    res.status(500).json({ error: "Error saving data" });
  }
});

/////////////its the final big surge route
function formatToLastZero(value) {
  // Round to 1 decimal and ensure last digit is '0'
  return (Math.round(value * 10) / 10).toFixed(2).replace(/.$/, "0");
}
function parseTradeSignal(signal) {
  const regex =
    /(?<transactionType>LONG|SHORT) (?<symbol>[A-Z]+) at (?<price>\d+\.?\d*) \| Stop Loss: (?<stopLoss>\d+\.?\d*) \| Target: (?<target>\d+\.?\d*)/;
  const match = signal.match(regex);

  if (match && match.groups) {
    const transactionType =
      match.groups.transactionType === "LONG" ? "BUY" : "SELL";
    const symbol = match.groups.symbol; // Dynamically capture the symbol
    const price = formatToLastZero(parseFloat(match.groups.price));
    const stopLoss = formatToLastZero(parseFloat(match.groups.stopLoss));
    const target = formatToLastZero(parseFloat(match.groups.target));

    return { transactionType, symbol, price, stopLoss, target };
  }

  return null;
}

// HTML to PDF conversion using Puppeteer

// Send PDF to Telegram chat

const botToken = CONFIG.EPICRISE.TELEGRAM_BOT_TOKEN;
const chatId = CONFIG.EPICRISE.CHANNEL_ID;

app.get("/MoAdd", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Mouser.html"));
});

app.get("/DhanAdd", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Dhanuser.html"));
});

// Route to save user data
app.post("/api/users/save-auth-token", async (req, res) => {
  try {
    const {
      userId,
      password,
      apiKey,
      twoFA,
      totpKey,
      clientName,
      email,
      phoneNumber,
      authToken,
      capital,
    } = req.body;

    // Validate required fields
    if (
      !userId ||
      !password ||
      !apiKey ||
      !twoFA ||
      !totpKey ||
      !clientName ||
      !email ||
      !phoneNumber ||
      !capital
    ) {
      return res
        .status(400)
        .json({ error: "All required fields must be filled" });
    }

    // Save to the database
    const user = new MOUser({
      userId,
      password,
      apiKey,
      twoFA,
      totpKey,
      clientName,
      email,
      phoneNumber,
      capital,
      authToken,
    });
    await user.save();

    res.status(200).json({ message: "User data saved successfully!" });
  } catch (error) {
    console.error("Error saving user data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate a hashed password
function generateHash(password, apiKey) {
  const hash = crypto.createHash("sha256");
  hash.update(password + apiKey);
  return hash.digest("hex");
}

// Authenticate with the API for each client
async function loginToMotilalOswalForAllClients() {
  try {
    const credentials = await getNetworkCredentials();
    const { macAddress, localIp, publicIp } = credentials;
    // console.log("Credentials:", credentials);

    // Fetch all user data from the database
    const users = await MOUser.find();

    // Process each user
    for (const userData of users) {
      const { userId, password, apiKey, twoFA, totpKey } = userData;

      // Generate the OTP based on the TOTP key from DB
      const { otp } = TOTP.generate(totpKey);
      console.log(`Generated OTP for ${userId}:`, otp);

      // Generate hashed password
      const hashedPassword = generateHash(password, apiKey);

      // Define the request payload
      const payload = {
        userid: userId,
        password: hashedPassword,
        "2FA": twoFA,
        totp: otp,
      };

      // Define the headers
      const headers = {
        Accept: "application/json",
        "User-Agent": "MOSL/V.1.1.0",
        ApiKey: apiKey,
        ClientLocalIp: localIp,
        ClientPublicIp: publicIp,
        MacAddress: macAddress,
        SourceId: "WEB",
        vendorinfo: userId,
        osname: "Windows 10",
        osversion: "10.0.19041",
        devicemodel: "AHV",
        manufacturer: "Google",
        productname: "Server",
        productversion: "10.2.3.652",
        browsername: "Chrome",
        browserversion: "105.0",
      };

      // Define the API endpoint
      const apiUrl =
        "https://openapi.motilaloswal.com/rest/login/v3/authdirectapi";

      try {
        // Make the API call
        const response = await axios.post(apiUrl, payload, { headers });

        // Log the response
        console.log(`Login Response for ${userId}:`, response.data);

        // Store the AuthToken in the user record
        userData.authToken = response.data.AuthToken;
        await userData.save();

        console.log(`AuthToken stored for ${userId}:`, userData.authToken);
      } catch (error) {
        console.error(
          `Error during login for ${userId}:`,
          error.response?.data || error.message
        );
      }
    }
  } catch (error) {
    console.error("Error fetching users from the database:", error);
  }
}

// ShareKhan Login Function - Generate Access Tokens for all ShareKhan clients
async function loginToShareKhanForAllClients() {
  try {
    console.log("🔐 Starting ShareKhan login process for all clients...");

    const credentials = await getNetworkCredentials();
    const { macAddress, localIp, publicIp } = credentials;

    // Fetch all ShareKhan users from the database
    const users = await ShareKhanUser.find();

    if (!users || users.length === 0) {
      console.log("⚠️ No ShareKhan users found in database");
      return;
    }

    console.log(`📊 Found ${users.length} ShareKhan users to process`);

    // Process each user
    for (const userData of users) {
      const { userId, apiKey, vendorKey, clientName } = userData;

      console.log(`🔄 Processing ShareKhan login for: ${clientName} (${userId})`);

      try {
        // Step 1: Generate Login URL (ShareKhan uses redirect-based login)
        const loginPayload = {
          userid: userId,
          vendorkey: vendorKey || apiKey // Use vendorKey if provided, otherwise apiKey
        };

        const loginHeaders = {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "ShareKhan-API-Client/1.0",
          "X-ClientLocalIP": localIp,
          "X-ClientPublicIP": publicIp,
          "X-MACAddress": macAddress
        };

        console.log(`📡 Sending login request for ${userId}...`);

        // ShareKhan Login API endpoint
        const loginResponse = await axios.post(
          "https://api.sharekhan.com/skapi/auth/login",
          loginPayload,
          { headers: loginHeaders }
        );

        console.log(`✅ Login response for ${userId}:`, loginResponse.data);

        if (loginResponse.data && loginResponse.data.success) {
          const requestToken = loginResponse.data.data.requestToken;

          // Step 2: Generate Access Token using Request Token
          const accessTokenPayload = {
            requestToken: requestToken,
            apiKey: apiKey
          };

          console.log(`🔑 Generating access token for ${userId}...`);

          const accessTokenResponse = await axios.post(
            "https://api.sharekhan.com/skapi/auth/accessToken",
            accessTokenPayload,
            { headers: loginHeaders }
          );

          console.log(`✅ Access token response for ${userId}:`, accessTokenResponse.data);

          if (accessTokenResponse.data && accessTokenResponse.data.success) {
            const accessToken = accessTokenResponse.data.data.accessToken;
            const tokenValidity = accessTokenResponse.data.data.validity;

            // Update user record with tokens
            userData.requestToken = requestToken;
            userData.accessToken = accessToken;
            userData.tokenValidity = new Date(tokenValidity);
            userData.lastLoginTime = new Date();
            userData.loginStatus = "success";
            userData.tradingStatus = "active";

            await userData.save();

            console.log(`✅ Tokens stored successfully for ${userId}`);
            console.log(`   📅 Token validity: ${tokenValidity}`);
            console.log(`   🔑 Access token: ${accessToken.substring(0, 20)}...`);

          } else {
            throw new Error(`Access token generation failed: ${accessTokenResponse.data?.message || 'Unknown error'}`);
          }

        } else {
          throw new Error(`Login failed: ${loginResponse.data?.message || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`❌ Error during ShareKhan login for ${userId}:`, error.response?.data || error.message);

        // Update user record with failed status
        userData.loginStatus = "failed";
        userData.tradingStatus = "inactive";
        userData.lastLoginTime = new Date();
        await userData.save();
      }

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("🎉 ShareKhan login process completed for all clients");

  } catch (error) {
    console.error("💥 Error in ShareKhan login process:", error);
  }
}

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

app.post("/addAngeluser", async (req, res) => {
  try {
    const userData = req.body;
    const newUser = new Angeluser(userData);
    await newUser.save();
    res.json({ message: "User added successfully!" });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Failed to add user." });
  }
});

app.post("/addDhanuser", async (req, res) => {
  try {
    console.log("🔍 Dhan user creation request received");
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));

    const userData = req.body;

    // Validate required fields
    const { email, phoneNumber, clientName, dhanClientId, jwtToken, capital } = userData;
    console.log("🔍 Extracted fields:", { email, phoneNumber, clientName, dhanClientId, jwtToken, capital });

    if (!email || !phoneNumber || !clientName || !dhanClientId || !jwtToken || !capital) {
      console.log("❌ Validation failed - missing required fields");
      console.log("Missing fields:", {
        email: !email ? "MISSING" : "OK",
        phoneNumber: !phoneNumber ? "MISSING" : "OK",
        clientName: !clientName ? "MISSING" : "OK",
        dhanClientId: !dhanClientId ? "MISSING" : "OK",
        jwtToken: !jwtToken ? "MISSING" : "OK",
        capital: !capital ? "MISSING" : "OK"
      });
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    console.log("✅ All required fields present, proceeding with user creation");
    console.log("💾 Creating new Dhan user with data:", JSON.stringify(userData, null, 2));

    const newUser = new DhanUser(userData);
    await newUser.save();

    console.log(`✅ Dhan user added successfully: ${clientName} (${dhanClientId})`);
    res.json({ message: "Dhan user added successfully!" });
  } catch (error) {
    console.error("❌ Error adding Dhan user:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to add Dhan user." });
  }
});

app.post("/addShareKhanuser", async (req, res) => {
  try {
    console.log("🔍 ShareKhan user creation request received");
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));

    const userData = req.body;

    // Validate required fields for ShareKhan
    const { email, phoneNumber, clientName, userId, apiKey, capital } = userData;
    console.log("🔍 Extracted fields:", { email, phoneNumber, clientName, userId, apiKey, capital: capital });

    if (!email || !phoneNumber || !clientName || !userId || !apiKey || !capital) {
      console.log("❌ Validation failed - missing required fields");
      console.log("Missing fields:", {
        email: !email ? "MISSING" : "OK",
        phoneNumber: !phoneNumber ? "MISSING" : "OK",
        clientName: !clientName ? "MISSING" : "OK",
        userId: !userId ? "MISSING" : "OK",
        apiKey: !apiKey ? "MISSING" : "OK",
        capital: !capital ? "MISSING" : "OK"
      });
      return res.status(400).json({ error: "All required fields must be filled (email, phoneNumber, clientName, userId, apiKey, capital)" });
    }

    console.log("✅ All required fields present, proceeding with user creation");

    // Set initial status
    userData.loginStatus = "pending";
    userData.tradingStatus = "inactive";

    console.log("💾 Creating new ShareKhan user with data:", JSON.stringify(userData, null, 2));
    const newUser = new ShareKhanUser(userData);
    await newUser.save();

    console.log(`✅ ShareKhan user added successfully: ${clientName} (${userId})`);
    res.json({ message: "ShareKhan user added successfully! Login tokens will be generated during next scheduled login." });
  } catch (error) {
    console.error("❌ Error adding ShareKhan user:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to add ShareKhan user." });
  }
});

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

// Motilal Oswal login cron job - runs at 3:00 AM daily
schedule.scheduleJob("00 3 * * *", async () => {
  console.log("Motilal Oswal scheduled login task triggered at 3:00 AM");
  await loginToMotilalOswalForAllClients();
});

// IIFL login cron job - runs at 3:00 AM daily (same time as Motilal)
schedule.scheduleJob("00 3 * * *", async () => {
  console.log("IIFL scheduled login task triggered at 3:00 AM");
  await loginToIIFLForAllClients();
});

// ShareKhan login cron job - runs at 3:35 AM daily
schedule.scheduleJob("35 3 * * *", async () => {
  console.log("ShareKhan scheduled login task triggered at 3:35 AM");
  await loginToShareKhanForAllClients();
});

// API Routes (Protected with authentication)
app.use("/api", verifyAuth, apiRouter); // New subscription management API
app.use("/api/order-responses", verifyAuth, orderResponsesRouter);
app.use("/api/dashboard", verifyAuth, dashboardRouter);
app.use("/api/enhanced-dashboard", verifyAuth, enhancedDashboardRouter);
app.use("/api/users", verifyAuth, usersRouter);

// Strategy Routes (Webhook routes - NO authentication required for TradingView webhooks)
app.use("/Epicrise", EpicriseRouter);
app.use("/CMI", CMIRouter);
app.use("/OptionTrade", OptionTradeRouter);
app.use("/BankNifty", BankNiftyRouter);

// Manual trigger endpoints for testing
app.post("/api/trigger-sharekhan-login", async (req, res) => {
  try {
    console.log("🔄 Manual ShareKhan login trigger initiated");
    await loginToShareKhanForAllClients();
    res.json({ success: true, message: "ShareKhan login process completed" });
  } catch (error) {
    console.error("Error in manual ShareKhan login:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
