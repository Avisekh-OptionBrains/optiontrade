const axios = require("axios");
require("dotenv").config();

async function testOptionChain() {
  console.log("🔍 Testing Dhan Option Chain API...\n");

  const accessToken = process.env.ACCESS_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!accessToken || !clientId) {
    console.error("❌ ACCESS_TOKEN or CLIENT_ID not found in .env file!");
    return;
  }

  try {
    // Step 1: Get expiry list
    console.log("1️⃣ Fetching expiry list for NIFTY...");
    const expiryResponse = await axios.post(
      "https://api.dhan.co/v2/optionchain/expirylist",
      {
        UnderlyingScrip: 13,
        UnderlyingSeg: "IDX_I",
      },
      {
        headers: {
          "access-token": accessToken,
          "client-id": clientId,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Expiry list fetched`);
    console.log(`   First expiry: ${expiryResponse.data.data[0]}`);

    // Wait 3 seconds for rate limit
    console.log("\n⏳ Waiting 3 seconds for rate limit...\n");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Get option chain
    console.log("2️⃣ Fetching option chain...");
    const firstExpiry = expiryResponse.data.data[0];
    const optionChainResponse = await axios.post(
      "https://api.dhan.co/v2/optionchain",
      {
        UnderlyingScrip: 13,
        UnderlyingSeg: "IDX_I",
        Expiry: firstExpiry,
      },
      {
        headers: {
          "access-token": accessToken,
          "client-id": clientId,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Option chain fetched`);
    console.log(`   Status: ${optionChainResponse.data.status}`);
    console.log(`   Last Price: ${optionChainResponse.data.data.last_price}`);

    // Step 3: Examine structure of one strike
    const strikes = optionChainResponse.data.data.oc;
    const strikeKeys = Object.keys(strikes);
    
    console.log(`\n📊 Total strikes available: ${strikeKeys.length}`);
    console.log(`   First strike: ${strikeKeys[0]}`);
    console.log(`   Last strike: ${strikeKeys[strikeKeys.length - 1]}`);

    // Get a middle strike to examine
    const middleStrike = strikeKeys[Math.floor(strikeKeys.length / 2)];
    const strikeData = strikes[middleStrike];

    console.log(`\n🔍 Examining strike: ${middleStrike}`);
    console.log("\n=== CALL (CE) DATA ===");
    console.log(JSON.stringify(strikeData.ce, null, 2));

    console.log("\n=== PUT (PE) DATA ===");
    console.log(JSON.stringify(strikeData.pe, null, 2));

    // Check what price fields are available
    console.log("\n💰 Available Price Fields:");
    console.log("\nCE (Call):");
    Object.keys(strikeData.ce).forEach(key => {
      if (key.toLowerCase().includes('price') || key.toLowerCase().includes('ltp') || key.toLowerCase().includes('ask') || key.toLowerCase().includes('bid')) {
        console.log(`   ${key}: ${strikeData.ce[key]}`);
      }
    });

    console.log("\nPE (Put):");
    Object.keys(strikeData.pe).forEach(key => {
      if (key.toLowerCase().includes('price') || key.toLowerCase().includes('ltp') || key.toLowerCase().includes('ask') || key.toLowerCase().includes('bid')) {
        console.log(`   ${key}: ${strikeData.pe[key]}`);
      }
    });

    // Check greeks
    console.log("\n📈 Greeks:");
    console.log(`   CE Delta: ${strikeData.ce.greeks?.delta}`);
    console.log(`   PE Delta: ${strikeData.pe.greeks?.delta}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testOptionChain();

