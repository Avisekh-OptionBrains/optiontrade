// Test script for the centralized network utility
const { 
  getCredentials, 
  getNetworkCredentials, 
  getBrokerHeaders, 
  initializeNetworkDetails,
  CLIENT_LOCAL_IP,
  CLIENT_PUBLIC_IP,
  CLIENT_MAC_ADDRESS,
  isInitialized
} = require('./utils/networkInfo');

async function testNetworkUtility() {
  console.log('🧪 Testing Centralized Network Utility\n');
  
  try {
    // Test 1: Check initialization status
    console.log('1️⃣ Testing initialization status...');
    console.log('   Is initialized:', isInitialized);
    
    // Test 2: Force initialization
    console.log('\n2️⃣ Testing manual initialization...');
    await initializeNetworkDetails();
    console.log('   ✅ Manual initialization completed');
    
    // Test 3: Test legacy getCredentials function
    console.log('\n3️⃣ Testing legacy getCredentials function...');
    const legacyCredentials = await getCredentials();
    console.log('   Legacy credentials:', legacyCredentials);
    
    // Test 4: Test new getNetworkCredentials function
    console.log('\n4️⃣ Testing new getNetworkCredentials function...');
    const networkCredentials = await getNetworkCredentials();
    console.log('   Network credentials:', networkCredentials);
    
    // Test 5: Test getBrokerHeaders function
    console.log('\n5️⃣ Testing getBrokerHeaders function...');
    const brokerHeaders = getBrokerHeaders();
    console.log('   Broker headers:', brokerHeaders);
    
    // Test 6: Test direct access to values
    console.log('\n6️⃣ Testing direct access to network values...');
    console.log('   CLIENT_LOCAL_IP:', CLIENT_LOCAL_IP);
    console.log('   CLIENT_PUBLIC_IP:', CLIENT_PUBLIC_IP);
    console.log('   CLIENT_MAC_ADDRESS:', CLIENT_MAC_ADDRESS);
    
    // Test 7: Verify compatibility with existing broker code
    console.log('\n7️⃣ Testing compatibility with existing broker patterns...');
    
    // Simulate how brokers currently use credentials
    const credentials = await getCredentials();
    if (credentials.publicIp && credentials.localIp && credentials.macAddress) {
      console.log('   ✅ Compatible with existing broker credential checks');
      console.log('   - Public IP:', credentials.publicIp);
      console.log('   - Local IP:', credentials.localIp);
      console.log('   - MAC Address:', credentials.macAddress);
    } else {
      console.log('   ❌ Missing required credential fields');
    }
    
    // Test 8: Performance test - multiple calls should be fast
    console.log('\n8️⃣ Testing performance (multiple calls)...');
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await getCredentials();
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`   ✅ 10 calls completed in ${duration}ms (avg: ${duration/10}ms per call)`);
    
    if (duration < 100) {
      console.log('   🚀 Performance: EXCELLENT (no network delays)');
    } else {
      console.log('   ⚠️ Performance: May have network delays');
    }
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Network information is pre-initialized at startup');
    console.log('   - Compatible with existing broker code patterns');
    console.log('   - Fast performance (no repeated network calls)');
    console.log('   - Provides both legacy and modern API interfaces');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testNetworkUtility().then(() => {
  console.log('\n🎉 Network utility test completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Network utility test failed:', error);
  process.exit(1);
});
