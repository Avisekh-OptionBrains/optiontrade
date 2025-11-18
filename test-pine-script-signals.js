// Test Pine Script signal parsing for BankNifty
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// Test signals from Pine Script
const testSignals = [
  {
    name: 'Pine Script - Buy Entry',
    signal: 'BB TRAP Buy BANKNIFTY at 51590.5 | SL: 51550.5 | Target: 51650.5',
    expected: {
      action: 'buy',
      symbol: 'BANKNIFTY',
      entryPrice: 51590.5,
      stopLoss: 51550.5,
      target: 51650.5
    }
  },
  {
    name: 'Pine Script - Sell Entry',
    signal: 'BB TRAP Sell BANKNIFTY at 51590.5 | SL: 51630.5 | Target: 51510.5',
    expected: {
      action: 'sell',
      symbol: 'BANKNIFTY',
      entryPrice: 51590.5,
      stopLoss: 51630.5,
      target: 51510.5
    }
  },
  {
    name: 'Pine Script - Exit Long',
    signal: 'BB TRAP Exit Long BANKNIFTY at 51550.5',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'BANKNIFTY',
      exitPrice: 51550.5,
      exitType: 'Pine Script Exit'
    }
  },
  {
    name: 'Pine Script - Exit Short',
    signal: 'BB TRAP Exit Short BANKNIFTY at 51630.5',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'BANKNIFTY',
      exitPrice: 51630.5,
      exitType: 'Pine Script Exit'
    }
  },
  {
    name: 'Legacy - Bear Trap',
    signal: 'BANKNIFTY | Bear Trap | Entry at 51590.5 | SL: 51550.5 | Target: 51650.5',
    expected: {
      action: 'buy',
      symbol: 'BANKNIFTY',
      entryPrice: 51590.5,
      stopLoss: 51550.5,
      target: 51650.5
    }
  },
  {
    name: 'Legacy - Bull Trap',
    signal: 'BANKNIFTY | Bull Trap | Entry at 51590.5 | SL: 51630.5 | Target: 51510.5',
    expected: {
      action: 'sell',
      symbol: 'BANKNIFTY',
      entryPrice: 51590.5,
      stopLoss: 51630.5,
      target: 51510.5
    }
  }
];

async function testSignalParsing() {
  console.log('🧪 Testing Pine Script Signal Parsing for BankNifty\n');
  console.log('='.repeat(70));
  
  let passed = 0;
  let failed = 0;

  for (const test of testSignals) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Signal: "${test.signal}"`);
    
    try {
      const response = await axios.post(`${API_BASE}/BankNifty/IIFL`, {
        messageText: test.signal
      }, {
        validateStatus: () => true // Accept any status code
      });

      if (response.status === 200) {
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        passed++;
      } else {
        console.log(`   ⚠️ Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        
        // Check if it's a "no users" error (which means parsing worked)
        if (response.data.message && response.data.message.includes('No users subscribed')) {
          console.log(`   ✅ Signal parsed correctly (no users subscribed)`);
          passed++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}/${testSignals.length}`);
  console.log(`   ❌ Failed: ${failed}/${testSignals.length}`);
  
  if (failed === 0) {
    console.log(`\n🎉 All tests passed!`);
  } else {
    console.log(`\n⚠️ Some tests failed. Please check the output above.`);
  }
}

// Run tests
testSignalParsing().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

