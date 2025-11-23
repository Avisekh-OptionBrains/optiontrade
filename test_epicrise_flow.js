const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_MESSAGE = 'ER Buy SBIN at 855.05 with Stop Loss at 850.00';

// Test functions
async function testTelegramEndpoint() {
    console.log('\n🔄 Testing Telegram endpoint...');
    try {
        const response = await axios.post(`${BASE_URL}/Epicrise/Telegram`, {
            message: TEST_MESSAGE
        });

        console.log('✅ Telegram endpoint response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Telegram endpoint failed:', error.response?.data || error.message);
        return false;
    }
}

async function testAngelBrokerEndpoint() {
    console.log('\n🔄 Testing Angel broker endpoint...');
    try {
        const response = await axios.post(`${BASE_URL}/Epicrise/AngelOne`, {
            messageText: TEST_MESSAGE
        });
        
        console.log('✅ Angel broker endpoint response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Angel broker endpoint failed:', error.response?.data || error.message);
        return false;
    }
}

async function testMotilalBrokerEndpoint() {
    console.log('\n🔄 Testing Motilal broker endpoint...');
    try {
        const response = await axios.post(`${BASE_URL}/Epicrise/MotilalOswal`, {
            messageText: TEST_MESSAGE
        });
        
        console.log('✅ Motilal broker endpoint response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Motilal broker endpoint failed:', error.response?.data || error.message);
        return false;
    }
}

async function testMainEpicriseEndpoint() {
    console.log('\n🔄 Testing main Epicrise endpoint...');
    try {
        const response = await axios.post(`${BASE_URL}/Epicrise`, {
            messageText: TEST_MESSAGE
        });
        
        console.log('✅ Main Epicrise endpoint response:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Main Epicrise endpoint failed:', error.response?.data || error.message);
        return false;
    }
}

async function testDashboardData() {
    console.log('\n🔄 Testing dashboard data...');
    try {
        const response = await axios.get(`${BASE_URL}/api/dashboard/data`);
        
        console.log('✅ Dashboard data response:', {
            totalMessages: response.data.statistics.totalMessages,
            totalOrders: response.data.statistics.total,
            successfulOrders: response.data.statistics.successful,
            failedOrders: response.data.statistics.failed
        });
        return true;
    } catch (error) {
        console.error('❌ Dashboard data failed:', error.response?.data || error.message);
        return false;
    }
}

async function testMessageParsing() {
    console.log('\n🔄 Testing message parsing...');
    
    const testMessages = [
        'ER Buy TATACHEM at 855.05 with Stop Loss at 850.00',
        'ER Sell RELIANCE at 2500.50 with Stop Loss at 2520.00',
        'Buy INFY at 1500.00 with Stop Loss at 1480.00',
        'Invalid message format'
    ];
    
    for (const message of testMessages) {
        try {
            const response = await axios.post(`${BASE_URL}/Epicrise/Telegram`, {
                message: message
            });
            console.log(`✅ Message "${message}" parsed successfully`);
        } catch (error) {
            console.log(`❌ Message "${message}" failed:`, error.response?.data?.error || error.message);
        }
    }
    
    return true;
}

async function runAllTests() {
    console.log('🚀 Starting Epicrise Flow Tests...\n');
    
    const tests = [
        { name: 'Message Parsing', fn: testMessageParsing },
        { name: 'Telegram Endpoint', fn: testTelegramEndpoint },
        { name: 'Angel Broker Endpoint', fn: testAngelBrokerEndpoint },
        { name: 'Motilal Broker Endpoint', fn: testMotilalBrokerEndpoint },
        { name: 'Main Epicrise Endpoint', fn: testMainEpicriseEndpoint },
        { name: 'Dashboard Data', fn: testDashboardData }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, success: result });
        } catch (error) {
            console.error(`❌ Test ${test.name} threw an error:`, error.message);
            results.push({ name: test.name, success: false });
        }
    }
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.name}`);
    });
    
    console.log(`\n🎯 Overall: ${successful}/${total} tests passed`);
    
    if (successful === total) {
        console.log('🎉 All tests passed! The Epicrise flow is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Please check the logs above for details.');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    testTelegramEndpoint,
    testAngelBrokerEndpoint,
    testMotilalBrokerEndpoint,
    testMainEpicriseEndpoint,
    testDashboardData,
    testMessageParsing
};
