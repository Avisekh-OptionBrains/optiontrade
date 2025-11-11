const axios = require("axios");
require("dotenv").config();

async function testDhanAuth() {
  console.log("🔐 Testing Dhan API Authentication...\n");

  const accessToken = process.env.ACCESS_TOKEN;
  const clientId = process.env.CLIENT_ID;

  console.log("📋 Configuration:");
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Access Token: ${accessToken ? accessToken.substring(0, 50) + '...' : 'NOT SET'}\n`);

  if (!accessToken || !clientId) {
    console.error("❌ ACCESS_TOKEN or CLIENT_ID not found in .env file!");
    console.log("\n💡 Please set these in your .env file:");
    console.log("   CLIENT_ID=your_dhan_client_id");
    console.log("   ACCESS_TOKEN=your_dhan_access_token\n");
    return;
  }

  // Decode JWT to check expiry
  try {
    const tokenParts = accessToken.split('.');
    if (tokenParts.length === 3) {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      console.log("🔍 Token Details:");
      console.log(`   Issued At: ${new Date(payload.iat * 1000).toLocaleString()}`);
      console.log(`   Expires At: ${new Date(payload.exp * 1000).toLocaleString()}`);
      console.log(`   Dhan Client ID: ${payload.dhanClientId}`);
      
      const now = Date.now() / 1000;
      if (payload.exp < now) {
        console.log(`\n⚠️  TOKEN EXPIRED! Please generate a new token from Dhan.\n`);
      } else {
        const hoursLeft = ((payload.exp - now) / 3600).toFixed(1);
        console.log(`   ✅ Token valid for ${hoursLeft} more hours\n`);
      }
    }
  } catch (e) {
    console.log("⚠️  Could not decode token\n");
  }

  // Test API call
  console.log("🧪 Testing API call to Dhan...");
  console.log("   Endpoint: POST /v2/optionchain/expirylist");
  console.log("   Parameters: UnderlyingScrip=13 (NIFTY), UnderlyingSeg=IDX_I\n");

  try {
    const response = await axios.post(
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

    console.log("✅ API CALL SUCCESSFUL!\n");
    console.log("📊 Response:");
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Expiry dates available: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`   First expiry: ${response.data.data[0]}`);
      console.log(`   Last expiry: ${response.data.data[response.data.data.length - 1]}`);
    }

    console.log("\n✅ Dhan API authentication is working correctly! 🎉\n");

  } catch (error) {
    console.error("❌ API CALL FAILED!\n");
    
    if (error.response) {
      console.error("📋 Error Response:");
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.log("\n💡 Authentication Failed - Possible reasons:");
        console.log("   1. ACCESS_TOKEN is expired");
        console.log("   2. CLIENT_ID is incorrect");
        console.log("   3. Token was revoked\n");
        console.log("🔧 Solution:");
        console.log("   1. Login to Dhan: https://web.dhan.co/");
        console.log("   2. Go to API section");
        console.log("   3. Generate new Access Token");
        console.log("   4. Update ACCESS_TOKEN in .env file\n");
      }
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
}

testDhanAuth();

