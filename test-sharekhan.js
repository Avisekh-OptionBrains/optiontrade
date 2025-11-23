// Test script for ShareKhan broker integration
const axios = require('axios');

// Test ShareKhan user creation
async function testShareKhanUserCreation() {
    console.log('🧪 Testing ShareKhan User Creation...');
    
    const testUser = {
        email: 'test@sharekhan.com',
        phoneNumber: '9876543210',
        clientName: 'Test ShareKhan User',
        userId: 'BARKHAC03',
        apiKey: 'czRLABgUuBISa1DYpDBeeNQ8vl4i9NFd',
        vendorKey: 'test_vendor_key_12345', // Optional
        capital: 50000,
        state: 'live'
    };

    try {
        const response = await axios.post('http://localhost:3000/addShareKhanuser', testUser, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ ShareKhan user creation successful:', response.data);
        return true;
    } catch (error) {
        console.error('❌ ShareKhan user creation failed:', error.response?.data || error.message);
        return false;
    }
}

// Test ShareKhan API endpoint
async function testShareKhanAPI() {
    console.log('🧪 Testing ShareKhan API Endpoint...');
    
    const testMessage = "BUY RELIANCE 2450 SL 2400";

    try {
        const response = await axios.post('http://localhost:3000/Epicrise/ShareKhan', {
            message: testMessage
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ ShareKhan API test successful:', response.data);
        return true;
    } catch (error) {
        console.error('❌ ShareKhan API test failed:', error.response?.data || error.message);
        return false;
    }
}

// Test ShareKhan users retrieval
async function testShareKhanUsersRetrieval() {
    console.log('🧪 Testing ShareKhan Users Retrieval...');
    
    try {
        const response = await axios.get('http://localhost:3000/api/users/sharekhan');
        
        console.log('✅ ShareKhan users retrieval successful:', response.data);
        return true;
    } catch (error) {
        console.error('❌ ShareKhan users retrieval failed:', error.response?.data || error.message);
        return false;
    }
}

// Test user statistics with ShareKhan
async function testUserStatistics() {
    console.log('🧪 Testing User Statistics with ShareKhan...');

    try {
        const response = await axios.get('http://localhost:3000/api/users/stats/summary');

        console.log('✅ User statistics test successful:');
        console.log(`   Total Users: ${response.data.totalUsers}`);
        console.log(`   Angel Users: ${response.data.angelUsers}`);
        console.log(`   Motilal Users: ${response.data.motilalUsers}`);
        console.log(`   Dhan Users: ${response.data.dhanUsers}`);
        console.log(`   ShareKhan Users: ${response.data.shareKhanUsers}`);
        console.log(`   Active Users: ${response.data.activeUsers}`);
        return true;
    } catch (error) {
        console.error('❌ User statistics test failed:', error.response?.data || error.message);
        return false;
    }
}

// Test ShareKhan login trigger
async function testShareKhanLoginTrigger() {
    console.log('🧪 Testing ShareKhan Login Trigger...');

    try {
        const response = await axios.post('http://localhost:3000/api/trigger-sharekhan-login');

        console.log('✅ ShareKhan login trigger test successful:', response.data);
        return true;
    } catch (error) {
        console.error('❌ ShareKhan login trigger test failed:', error.response?.data || error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting ShareKhan Integration Tests...');
    console.log('='.repeat(50));
    
    const tests = [
        { name: 'ShareKhan User Creation', fn: testShareKhanUserCreation },
        { name: 'ShareKhan Users Retrieval', fn: testShareKhanUsersRetrieval },
        { name: 'User Statistics', fn: testUserStatistics },
        { name: 'ShareKhan Login Trigger', fn: testShareKhanLoginTrigger },
        { name: 'ShareKhan API Endpoint', fn: testShareKhanAPI }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        console.log(`\n📋 Running: ${test.name}`);
        const result = await test.fn();
        if (result) {
            passed++;
        } else {
            failed++;
        }
        console.log('-'.repeat(30));
    }
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${passed + failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 All ShareKhan integration tests passed!');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the errors above.');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testShareKhanUserCreation,
    testShareKhanAPI,
    testShareKhanUsersRetrieval,
    testUserStatistics,
    testShareKhanLoginTrigger,
    runAllTests
};
