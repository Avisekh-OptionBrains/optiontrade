// Test script for Dhan broker integration
const axios = require('axios');

async function testDhanBrokerEndpoint() {
  try {
    console.log('Testing Dhan broker endpoint...');
    
    // Test message that would typically come from a trading signal
    const testMessage = {
      messageText: "BUY SBIN 750 SL 730"
    };

    const response = await axios.post('http://localhost:3000/Epicrise/Dhan', testMessage, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('✅ Dhan broker endpoint test successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
    return true;
  } catch (error) {
    console.log('❌ Dhan broker endpoint test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return false;
  }
}

async function testDhanUserCreation() {
  try {
    console.log('\nTesting Dhan user creation endpoint...');
    
    const testUser = {
      email: "test@example.com",
      phoneNumber: "9876543210",
      clientName: "Test Dhan Client",
      dhanClientId: "1000000001",
      jwtToken: "test-jwt-token-123",
      capital: 100000,
      state: "live"
    };

    const response = await axios.post('http://localhost:3000/addDhanuser', testUser, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Dhan user creation test successful!');
    console.log('Response:', response.data);
    
    return true;
  } catch (error) {
    console.log('❌ Dhan user creation test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return false;
  }
}

async function testDhanUserRetrieval() {
  try {
    console.log('\nTesting Dhan user retrieval endpoint...');
    
    const response = await axios.get('http://localhost:3000/api/users/dhan');

    console.log('✅ Dhan user retrieval test successful!');
    console.log('Number of Dhan users:', response.data.length);
    
    return true;
  } catch (error) {
    console.log('❌ Dhan user retrieval test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Dhan Integration Tests...\n');
  
  const results = [];
  
  // Test user creation
  results.push(await testDhanUserCreation());
  
  // Test user retrieval
  results.push(await testDhanUserRetrieval());
  
  // Test broker endpoint
  results.push(await testDhanBrokerEndpoint());
  
  const passedTests = results.filter(result => result).length;
  const totalTests = results.length;
  
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Dhan integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run the tests
runAllTests().catch(console.error);
