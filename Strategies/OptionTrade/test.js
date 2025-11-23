const axios = require("axios");

/**
 * Test the OptionTrade strategy endpoints
 */

const BASE_URL = "http://localhost:3000";

// Test signals
const testSignals = {
  buySignal: "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2",
  sellSignal: "BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2",
  invalidSignal: "Some random text without BB TRAP format",
};

/**
 * Test health check endpoint
 */
async function testHealthCheck() {
  console.log("\n=== Test 1: Health Check ===");
  try {
    const response = await axios.get(`${BASE_URL}/OptionTrade/health`);
    console.log("✅ Health check passed");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return false;
  }
}

/**
 * Test IIFL health check endpoint
 */
async function testIIFLHealthCheck() {
  console.log("\n=== Test 2: IIFL Health Check ===");
  try {
    const response = await axios.get(`${BASE_URL}/OptionTrade/IIFL/health`);
    console.log("✅ IIFL health check passed");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error("❌ IIFL health check failed:", error.message);
    return false;
  }
}

/**
 * Test Buy signal processing
 */
async function testBuySignal() {
  console.log("\n=== Test 3: Buy Signal Processing ===");
  console.log("Signal:", testSignals.buySignal);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/OptionTrade/IIFL`,
      { messageText: testSignals.buySignal },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000, // 60 second timeout
      }
    );
    
    console.log("✅ Buy signal processed successfully");
    console.log("\nResponse Summary:");
    console.log(`  Success: ${response.data.success}`);
    console.log(`  Message: ${response.data.message}`);
    
    if (response.data.signal) {
      console.log(`\n  Signal:`);
      console.log(`    Action: ${response.data.signal.action.toUpperCase()}`);
      console.log(`    Symbol: ${response.data.signal.symbol}`);
      console.log(`    Entry: ₹${response.data.signal.entryPrice}`);
      console.log(`    Stop Loss: ₹${response.data.signal.stopLoss}`);
      console.log(`    Target: ₹${response.data.signal.target}`);
    }
    
    if (response.data.orders) {
      console.log(`\n  Orders: ${response.data.orders.length}`);
      response.data.orders.forEach((order, index) => {
        console.log(`    ${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price}`);
      });
    }
    
    if (response.data.results) {
      const successful = response.data.results.filter(r => r.success).length;
      const failed = response.data.results.filter(r => !r.success).length;
      console.log(`\n  Results:`);
      console.log(`    Successful: ${successful}`);
      console.log(`    Failed: ${failed}`);
    }
    
    return true;
  } catch (error) {
    console.error("❌ Buy signal processing failed");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
    return false;
  }
}

/**
 * Test Sell signal processing
 */
async function testSellSignal() {
  console.log("\n=== Test 4: Sell Signal Processing ===");
  console.log("Signal:", testSignals.sellSignal);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/OptionTrade/IIFL`,
      { messageText: testSignals.sellSignal },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
      }
    );
    
    console.log("✅ Sell signal processed successfully");
    console.log("\nResponse Summary:");
    console.log(`  Success: ${response.data.success}`);
    console.log(`  Message: ${response.data.message}`);
    
    if (response.data.signal) {
      console.log(`\n  Signal:`);
      console.log(`    Action: ${response.data.signal.action.toUpperCase()}`);
      console.log(`    Symbol: ${response.data.signal.symbol}`);
      console.log(`    Entry: ₹${response.data.signal.entryPrice}`);
      console.log(`    Stop Loss: ₹${response.data.signal.stopLoss}`);
      console.log(`    Target: ₹${response.data.signal.target}`);
    }
    
    if (response.data.orders) {
      console.log(`\n  Orders: ${response.data.orders.length}`);
      response.data.orders.forEach((order, index) => {
        console.log(`    ${index + 1}. ${order.action} ${order.type} Strike ${order.strike} at ₹${order.price}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error("❌ Sell signal processing failed");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
    return false;
  }
}

/**
 * Test invalid signal handling
 */
async function testInvalidSignal() {
  console.log("\n=== Test 5: Invalid Signal Handling ===");
  console.log("Signal:", testSignals.invalidSignal);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/OptionTrade/IIFL`,
      { messageText: testSignals.invalidSignal },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
    
    console.log("❌ Invalid signal should have been rejected");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    return false;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log("✅ Invalid signal correctly rejected");
      console.log("Error message:", error.response.data.error);
      return true;
    } else {
      console.error("❌ Unexpected error:", error.message);
      return false;
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         OptionTrade Strategy - Test Suite                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  console.log("\n⚠️  IMPORTANT:");
  console.log("   - Make sure the server is running on port 3000");
  console.log("   - Dhan API credentials must be configured in .env");
  console.log("   - data.csv file must be present with security IDs");
  console.log("   - MongoDB should be running (or JSON fallback will be used)");
  console.log("\nStarting tests in 3 seconds...\n");
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const results = {
    healthCheck: false,
    iiflHealthCheck: false,
    buySignal: false,
    sellSignal: false,
    invalidSignal: false,
  };
  
  // Run tests
  results.healthCheck = await testHealthCheck();
  results.iiflHealthCheck = await testIIFLHealthCheck();
  
  // Only run signal tests if health checks pass
  if (results.healthCheck && results.iiflHealthCheck) {
    console.log("\n⚠️  The next tests will make real API calls to Dhan and attempt to place orders via IIFL.");
    console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    results.buySignal = await testBuySignal();
    
    // Wait between tests to respect rate limits
    console.log("\n⏳ Waiting 5 seconds before next test (rate limiting)...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    results.sellSignal = await testSellSignal();
    results.invalidSignal = await testInvalidSignal();
  } else {
    console.log("\n⚠️  Skipping signal tests because health checks failed");
  }
  
  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    Test Summary                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n  Health Check:           ${results.healthCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  IIFL Health Check:      ${results.iiflHealthCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Buy Signal:             ${results.buySignal ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Sell Signal:            ${results.sellSignal ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Invalid Signal:         ${results.invalidSignal ? '✅ PASS' : '❌ FAIL'}`);
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  console.log(`\n  Total: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log("\n🎉 All tests passed! OptionTrade strategy is working correctly.");
  } else {
    console.log("\n⚠️  Some tests failed. Please check the logs above for details.");
  }
  
  console.log("\n");
}

// Run tests
runAllTests().catch(error => {
  console.error("\n❌ Test suite failed with error:", error);
  process.exit(1);
});

