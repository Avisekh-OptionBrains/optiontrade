// const express = require("express");
// const axios = require("axios");
// const bodyParser = require("body-parser");
// const cookieParser = require("cookie-parser");
// const Order = require("./models/orderModel"); // Adjust the path based on where you saved the model
// const schedule = require("node-schedule");
// const path = require("path");
// const getCredentials = require("./cred"); // Adjust path accordingly
// const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
// const {
//   initializeDatabaseConnection,
//   findSymbolInDatabase,
//   main,
// } = require("./newdb");

// const router = express.Router();
// const Angeluser = require("./models/Angeluser");

// router.post("/BigSurge", async (req, res) => {
//   console.log("Route: /BigSurgeOrderPlacement3014");
//   const credentials = await getCredentials();

//   try {
//     let messageText = req.body;

//     // Ensure the messageText is extracted correctly
//     if (typeof messageText === "object" && messageText.messageText) {
//       messageText = messageText.messageText;
//     }

//     if (!messageText) {
//       console.error("Error: Message text is missing.");
//       return res.status(400).json({ error: "Message text is required" });
//     }

//     // Parse the message text
//     const parsedMessage = parseTradeSignal(messageText);
//     if (!parsedMessage) {
//       console.error("Error: Invalid message format.");
//       return res.status(400).json({ error: "Invalid message format" });
//     }
//     console.log("Parsed Message:", parsedMessage);

//     const { transactionType, symbol, price, stopLoss, target } = parsedMessage;

//     if (!transactionType || !symbol || !price || !stopLoss || !target) {
//       console.error("Error: Missing required fields in parsed message.");
//       return res
//         .status(400)
//         .json({ error: "Missing required fields in parsed message" });
//     }

//     const document = await findSymbolInDatabase(symbol);
//     if (!document) {
//       console.error(`Error: Symbol "${symbol}" not found in the database.`);
//       return res.status(404).json({ error: `Symbol "${symbol}" not found.` });
//     }

//     const clients = await Angeluser.find(); // Assuming `Client` is your Mongoose model
//     if (!clients.length) {
//       console.error("Error: No clients found.");
//       return res.status(404).json({ error: "No clients available." });
//     }

//     // Process orders for all clients
//     const ordersPromises = Angeluser.map((client) =>
//       processClientOrders(client, parsedMessage, document)
//     );

//     await Promise.all(ordersPromises);
//     console.log("All orders placed successfully.");

//     res.json({
//       message:
//         "Initial order placed. Stop-loss and target orders are being placed for each client.",
//     });
//   } catch (error) {
//     console.error("Error:", error.message || error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// module.exports = router;

// // Utility function to process orders for a single client
// // Utility function to process orders for a single client
// async function processClientOrders(client, parsedMessage, document) {
//   const { jwtToken, apiKey, capital: clientCapital, clientId } = client;
//   const { transactionType, price, stopLoss, target } = parsedMessage;

//   function buildOrderData(
//     document,
//     transactionType,
//     orderType,
//     quantity,
//     price = null,
//     triggerPrice = null
//   ) {
//     return {
//       variety: "NORMAL",
//       tradingsymbol: document.symbol,
//       symboltoken: document.token,
//       transactiontype: transactionType,
//       exchange: "NSE",
//       ordertype: orderType,
//       producttype: "INTRADAY",
//       duration: "DAY",
//       quantity: quantity,
//       ...(price && { price }),
//       ...(triggerPrice && { triggerprice: triggerPrice }),
//     };
//   }

//   if (!jwtToken || !apiKey) {
//     console.log(`Skipping client ${clientId} due to missing credentials.`);
//     return;
//   }

//   const quantity = Math.floor(clientCapital / price);
//   const reversedTransactionType = transactionType === "BUY" ? "SELL" : "BUY";

//   // Place initial order
//   const initialOrderData = buildOrderData(
//     document,
//     transactionType,
//     "MARKET",
//     quantity
//   );

//   try {
//     const initialOrderResponse = await placeOrder(
//       jwtToken,
//       apiKey,
//       initialOrderData
//     );
//     console.log(
//       `Initial order placed for client: ${clientId}`,
//       initialOrderResponse
//     );

//     // Save initial order response to MongoDB
//     await OrderparsedMessage.create({
//       clientId,
//       orderType: "INITIAL_ORDER",
//       routeName: "Bigsurge",
//       details: {
//         status: true,
//         message: "Initial order placed successfully",
//         script: document.symbol,
//         orderid: initialOrderResponse.orderid,
//         uniqueorderid: initialOrderResponse.uniqueorderid,
//         response: initialOrderResponse, // Save complete response
//         apiKey, // Save client API key
//         jwtToken, // Save client JWT token
//       },
//       createdAt: new Date(),
//     });
//   } catch (error) {
//     console.error(
//       `Failed to place initial order for client ${clientId}:`,
//       error.response?.data || error.message
//     );
//   }

//   // Place stop-loss order with a delay of 5 seconds
//   setTimeout(async () => {
//     const stopLossOrderData = buildOrderData(
//       document,
//       reversedTransactionType,
//       "STOPLOSS_LIMIT",
//       quantity,
//       formatToLastZero(stopLoss * 0.9975),
//       stopLoss
//     );
//     stopLossOrderData.variety = "STOPLOSS";

//     try {
//       const stopLossOrderResponse = await placeOrder(
//         jwtToken,
//         apiKey,
//         stopLossOrderData
//       );
//       console.log(
//         `Stop-loss order placed for client: ${clientId}`,
//         stopLossOrderResponse
//       );

//       // Save stop-loss order response to MongoDB
//       await OrderparsedMessage.create({
//         clientId,
//         orderType: "STOPLOSS_ORDER",
//         routeName: "Bigsurge",
//         details: {
//           status: true,
//           message: "Stop-loss order placed successfully",
//           script: document.symbol,
//           orderid: stopLossOrderResponse.orderid,
//           uniqueorderid: stopLossOrderResponse.uniqueorderid,
//           response: stopLossOrderResponse, // Save complete response
//           apiKey, // Save client API key
//           jwtToken, // Save client JWT token
//         },
//         createdAt: new Date(),
//       });
//     } catch (error) {
//       console.error(
//         `Failed to place stop-loss order for client ${clientId}:`,
//         error.response?.data || error.message
//       );
//     }
//   }, 5000); // Delay of 5 seconds for the stop-loss order

//   // Place target order with a delay of 10 seconds after the stop-loss
//   setTimeout(async () => {
//     const targetOrderData = buildOrderData(
//       document,
//       reversedTransactionType,
//       "LIMIT",
//       quantity,
//       target
//     );

//     try {
//       const targetOrderResponse = await placeOrder(
//         jwtToken,
//         apiKey,
//         targetOrderData
//       );
//       console.log(
//         `Target order placed for client: ${clientId}`,
//         targetOrderResponse
//       );

//       // Save target order response to MongoDB
//       await OrderparsedMessage.create({
//         clientId,
//         orderType: "TARGET_ORDER",
//         routeName: "Bigsurge",
//         details: {
//           status: true,
//           message: "Target order placed successfully",
//           script: document.symbol,
//           orderid: targetOrderResponse.orderid,
//           uniqueorderid: targetOrderResponse.uniqueorderid,
//           response: targetOrderResponse, // Save complete response
//           apiKey, // Save client API key
//           jwtToken, // Save client JWT token
//         },
//         createdAt: new Date(),
//       });
//     } catch (error) {
//       console.error(
//         `Failed to place target order for client ${clientId}:`,
//         error.response?.data || error.message
//       );
//     }
//   }, 15000); // Delay of 15 seconds (5 seconds stop-loss + 10 seconds target)
// }

// // Utility function to build order data

// // Utility function to place an order
// async function placeOrder(jwtToken, apiKey, orderData) {
//   const credentials = await getCredentials();
//   const { macAddress, localIp, publicIp } = credentials;
//   const config = {
//     method: "post",
//     url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/placeOrder",
//     headers: {
//       Authorization: `Bearer ${jwtToken}`,
//       "Content-Type": "application/json",
//       Accept: "application/json",
//       "X-UserType": "USER",
//       "X-SourceID": "WEB",
//       "X-ClientLocalIP": localIp, // Replace with actual value
//       "X-ClientPublicIP": publicIp, // Replace with actual value", // Replace with actual value
//       "X-MACAddress": macAddress, // Replace with actual value
//       "X-PrivateKey": apiKey,
//     },
//     data: JSON.stringify(orderData),
//   };

//   const response = await axios(config);
//   return response.data;
// }

// function parseTradeSignal(signal) {
//   const regex =
//     /(?<transactionType>LONG|SHORT) (?<symbol>[A-Z]+) at (?<price>\d+\.?\d*) \| Stop Loss: (?<stopLoss>\d+\.?\d*) \| Target: (?<target>\d+\.?\d*)/;
//   const match = signal.match(regex);

//   if (match && match.groups) {
//     const transactionType =
//       match.groups.transactionType === "LONG" ? "BUY" : "SELL";
//     const symbol = match.groups.symbol; // Dynamically capture the symbol
//     const price = formatToLastZero(parseFloat(match.groups.price));
//     const stopLoss = formatToLastZero(parseFloat(match.groups.stopLoss));
//     const target = formatToLastZero(parseFloat(match.groups.target));

//     return { transactionType, symbol, price, stopLoss, target };
//   }

//   return null;
// }
