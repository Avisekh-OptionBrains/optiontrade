const axios = require('axios');

async function testTradingSignal() {
  try {
    console.log('🚀 TESTING OPTION TRADE SIGNAL WITH LOT CONFIGURATION\n');
    console.log('=' .repeat(70) + '\n');
    
    // Simulate a trading signal
    const signal = `
      BB TRAP NIFTY
      Action: SELL
      Symbol: NIFTY1!
      Entry Price: 25955.2
      Stop Loss: 25995.2
      Target: 25855.2
    `;
    
    console.log('📨 Sending trading signal:\n');
    console.log(signal);
    console.log('\n' + '=' .repeat(70) + '\n');
    
    // Send to OptionTrade endpoint
    const response = await axios.post(
      'http://localhost:3001/OptionTrade',
      signal,
      {
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    );
    
    console.log('✅ Response from backend:\n');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n' + '=' .repeat(70));
    console.log('\n📊 VERIFICATION:\n');
    
    if (response.data.success) {
      console.log('✅ Signal processed successfully!');
      console.log(`   - Orders placed: ${response.data.ordersPlaced || 0}`);
      console.log(`   - Users found: ${response.data.usersFound || 0}`);
      console.log(`   - Broker execution: ${response.data.brokerExecution || 'N/A'}`);
      
      if (response.data.orders) {
        console.log('\n📋 Orders:');
        response.data.orders.forEach((order, i) => {
          console.log(`   ${i + 1}. ${order.type} ${order.action} @ ₹${order.price}`);
        });
      }
    } else {
      console.log('⚠️  Signal processing had issues');
      console.log(`   Error: ${response.data.error}`);
    }
    
    console.log('\n' + '=' .repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testTradingSignal();

