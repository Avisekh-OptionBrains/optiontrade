// const express = require("express");
// const puppeteer = require("puppeteer");
// const schedule = require("node-schedule");
// const axios = require("axios"); // Ensure axios is required
// const env = require("dotenv"); // Ensure dotenv is required to read environment variables

// // Initialize environment variables
// env.config();
// const getCredentials = require("./cred"); // Adjust path accordingly
// // Create a router instance
// const router = express.Router();

// // List of Nifty 50 tickers
// const nifty50Tickers = [
//   "NIFTY_50:INDEXNSE",
//   "NIFTY_500:INDEXNSE",
//   "NIFTY_BANK:INDEXNSE",
// ];

// // Dictionary to store ticker data
// let tickerData = {};

// // Fetch price for a specific ticker using Puppeteer
// async function fetchPrice(ticker) {
//   const url = `https://www.google.com/finance/quote/${ticker}`;

//   try {
//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();
//     await page.goto(url, { waitUntil: "domcontentloaded" });

//     // Define selectors for current price and previous close
//     const class1 = ".YMlKec.fxKbKc"; // Current price
//     const class2 = ".P6K39c"; // Previous close

//     const currentPriceText = await page.$eval(class1, (el) => el.textContent);
//     const previousCloseText = await page.$eval(class2, (el) => el.textContent);

//     const currentPrice = parseFloat(
//       currentPriceText.replace(",", "").replace("₹", "").trim()
//     );
//     const previousClose = parseFloat(
//       previousCloseText.replace(",", "").replace("₹", "").trim()
//     );

//     let priceChange = null;
//     let percentageChange = null;

//     if (!isNaN(currentPrice) && !isNaN(previousClose)) {
//       priceChange = (currentPrice - previousClose).toFixed(2);
//       percentageChange = ((priceChange / previousClose) * 100).toFixed(2);
//     }

//     await browser.close();

//     return {
//       ticker,
//       currentPrice: currentPrice || null,
//       previousClose: previousClose || null,
//       priceChange: priceChange || "Not available",
//       percentageChange: percentageChange || "Not available",
//     };
//   } catch (error) {
//     console.error(`Error fetching data for ${ticker}:`, error.message);
//     return {
//       ticker,
//       currentPrice: null,
//       previousClose: null,
//       priceChange: "Not available",
//       percentageChange: "Not available",
//     };
//   }
// }

// // Fetch position data from Angel One
// async function fetchPositionData() {
//   const jwtToken = env.JWT_TOKEN;
//   const apiKey = env.API_KEY;
//   const credentials = await getCredentials();
//   const { macAddress, localIp, publicIp } = credentials;

//   console.log("Credentials:", { macAddress, localIp, publicIp });

//   const config = {
//     method: "get",
//     url: "https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getPosition", // The URL you want to request
//     headers: {
//       Authorization: `Bearer ${jwtToken}`,
//       "Content-Type": "application/json",
//       Accept: "application/json",
//       "X-UserType": "USER",
//       "X-SourceID": "WEB",
//       "X-ClientLocalIP": localIp,
//       "X-ClientPublicIP": publicIp,
//       "X-MACAddress": macAddress,
//       "X-PrivateKey": apiKey,
//     },
//   };

//   try {
//     const response = await axios(config);
//     return response.data;
//   } catch (error) {
//     console.error("Error fetching position data:", error.message);
//     return { error: error.message };
//   }
// }

// // Update data for all tickers
// async function updateData() {
//   console.log("Updating data...");
//   const updatedData = {};

//   for (const ticker of nifty50Tickers) {
//     const data = await fetchPrice(ticker);
//     updatedData[ticker] = data;
//   }

//   tickerData = updatedData;
//   console.log("Data updated.");
// }

// // Schedule the updateData function to run every hour
// schedule.scheduleJob("0 * * * *", updateData); // This runs the function at the start of every hour

// // API route to get merged data (ticker data + position data)
// router.get("/api/tickerWithPosition", async (req, res) => {
//   try {
//     // Fetch both ticker and position data
//     const positionData = await fetchPositionData();
//     const updatedTickerData = tickerData; // Use already fetched ticker data

//     res.json({
//       tickerData: updatedTickerData,
//       positionData: positionData,
//     });
//   } catch (error) {
//     console.error("Error merging data:", error.message);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Initial data fetch when the router is loaded
// (async () => {
//   try {
//     await updateData(); // Call updateData() asynchronously
//   } catch (error) {
//     console.error("Error during initial data fetch:", error.message);
//   }
// })();

// module.exports = router;
