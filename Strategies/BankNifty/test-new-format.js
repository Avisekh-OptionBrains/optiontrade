/**
 * Test script for new Bank Nifty BB TRAP signal format
 *
 * New Entry Format:
 * - BUY: <TICKER> | Bear Trap | Entry at <ENTRY> | SL: <SL> | Target: <TARGET>
 * - SELL: <TICKER> | Bull Trap | Entry at <ENTRY> | SL: <SL> | Target: <TARGET>
 *
 * New Exit Format:
 * - LONG EXIT: BB TRAP LONG EXIT (SL HIT/TARGET HIT/3PM EXIT) <TICKER> at <PRICE>
 * - SHORT EXIT: BB TRAP SHORT EXIT (SL HIT/TARGET HIT/3PM EXIT) <TICKER> at <PRICE>
 */

const { parseBBTrapSignal } = require('./Brokers/IIFL/bankNiftyTradingHandler');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     TESTING NEW BANK NIFTY BB TRAP SIGNAL FORMAT          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test cases
const testCases = [
  {
    name: 'NEW FORMAT - Bear Trap (BUY)',
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
    name: 'NEW FORMAT - Bull Trap (SELL)',
    signal: 'BANKNIFTY | Bull Trap | Entry at 51590.5 | SL: 51630.5 | Target: 51510.5',
    expected: {
      action: 'sell',
      symbol: 'BANKNIFTY',
      entryPrice: 51590.5,
      stopLoss: 51630.5,
      target: 51510.5
    }
  },
  {
    name: 'NEW EXIT FORMAT - LONG EXIT (SL HIT)',
    signal: 'BB TRAP LONG EXIT (SL HIT) BANKNIFTY at 51550.5',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'BANKNIFTY',
      exitPrice: 51550.5,
      exitType: 'SL HIT'
    }
  },
  {
    name: 'NEW EXIT FORMAT - LONG EXIT (TARGET HIT)',
    signal: 'BB TRAP LONG EXIT (TARGET HIT) BANKNIFTY at 51650.5',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'BANKNIFTY',
      exitPrice: 51650.5,
      exitType: 'TARGET HIT'
    }
  },
  {
    name: 'NEW EXIT FORMAT - LONG EXIT (3PM EXIT)',
    signal: 'BB TRAP LONG EXIT (3PM EXIT) BANKNIFTY at 51590.5',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'BANKNIFTY',
      exitPrice: 51590.5,
      exitType: '3PM EXIT'
    }
  },
  {
    name: 'NEW EXIT FORMAT - SHORT EXIT (SL HIT)',
    signal: 'BB TRAP SHORT EXIT (SL HIT) BANKNIFTY at 51630.5',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'BANKNIFTY',
      exitPrice: 51630.5,
      exitType: 'SL HIT'
    }
  },
  {
    name: 'NEW EXIT FORMAT - SHORT EXIT (TARGET HIT)',
    signal: 'BB TRAP SHORT EXIT (TARGET HIT) BANKNIFTY at 51510.5',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'BANKNIFTY',
      exitPrice: 51510.5,
      exitType: 'TARGET HIT'
    }
  },
  {
    name: 'NEW EXIT FORMAT - SHORT EXIT (3PM EXIT)',
    signal: 'BB TRAP SHORT EXIT (3PM EXIT) BANKNIFTY at 51590.5',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'BANKNIFTY',
      exitPrice: 51590.5,
      exitType: '3PM EXIT'
    }
  },
  {
    name: 'OLD FORMAT - BB TRAP Buy',
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
    name: 'OLD FORMAT - BB TRAP Sell',
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
    name: 'OLD EXIT FORMAT - Intraday Exit',
    signal: 'BB TRAP Exit BANKNIFTY at 51590.5 | Intraday Exit',
    expected: {
      action: 'exit',
      symbol: 'BANKNIFTY',
      exitPrice: 51590.5,
      exitType: 'Intraday Exit'
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. Testing: ${testCase.name}`);
  console.log(`   Signal: "${testCase.signal}"`);
  
  const result = parseBBTrapSignal(testCase.signal);
  
  if (!result) {
    console.log('   ❌ FAILED: Could not parse signal');
    failed++;
    return;
  }
  
  console.log('   Parsed Result:', JSON.stringify(result, null, 2));
  
  // Validate result
  let isValid = true;
  for (const key in testCase.expected) {
    if (result[key] !== testCase.expected[key]) {
      console.log(`   ❌ FAILED: Expected ${key}="${testCase.expected[key]}", got "${result[key]}"`);
      isValid = false;
    }
  }
  
  if (isValid) {
    console.log('   ✅ PASSED');
    passed++;
  } else {
    failed++;
  }
});

// Summary
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                    TEST SUMMARY                            ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\n✅ Passed: ${passed}/${testCases.length}`);
console.log(`❌ Failed: ${failed}/${testCases.length}\n`);

if (failed === 0) {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the output above.\n');
  process.exit(1);
}

