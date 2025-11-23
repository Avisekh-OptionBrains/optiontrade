/**
 * Test script for OptionTrade BB TRAP signal formats
 * 
 * Tests all 10 signal format variations
 */

const { parseBBTrapSignal } = require('./Brokers/IIFL/optionTradingHandler');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     TESTING OPTIONTRADE BB TRAP SIGNAL FORMATS            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test cases covering all 10 signal formats
const testCases = [
  {
    name: '1. BB TRAP Buy Entry Signal',
    signal: 'BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2',
    expected: {
      action: 'buy',
      symbol: 'NIFTY1!',
      entryPrice: 25560.2,
      stopLoss: 25520.2,
      target: 25640.2
    }
  },
  {
    name: '2. BB TRAP Sell Entry Signal',
    signal: 'BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2',
    expected: {
      action: 'sell',
      symbol: 'NIFTY1!',
      entryPrice: 25560.2,
      stopLoss: 25600.2,
      target: 25480.2
    }
  },
  {
    name: '3. BB TRAP Exit Buy - SL Hit',
    signal: 'BB TRAP Exit Buy NIFTY1! at 25520.2 | SL Hit',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'NIFTY1!',
      exitPrice: 25520.2,
      exitType: 'SL Hit'
    }
  },
  {
    name: '4. BB TRAP Exit Buy - Target Hit',
    signal: 'BB TRAP Exit Buy NIFTY1! at 25640.2 | Target Hit',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'NIFTY1!',
      exitPrice: 25640.2,
      exitType: 'Target Hit'
    }
  },
  {
    name: '5. BB TRAP Exit Buy - Exit',
    signal: 'BB TRAP Exit Buy NIFTY1! at 25590.2 | Exit',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'NIFTY1!',
      exitPrice: 25590.2,
      exitType: 'Exit'
    }
  },
  {
    name: '6. BB TRAP Exit Sell - SL Hit',
    signal: 'BB TRAP Exit Sell NIFTY1! at 25600.2 | SL Hit',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'NIFTY1!',
      exitPrice: 25600.2,
      exitType: 'SL Hit'
    }
  },
  {
    name: '7. BB TRAP Exit Sell - Target Hit',
    signal: 'BB TRAP Exit Sell NIFTY1! at 25480.2 | Target Hit',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'NIFTY1!',
      exitPrice: 25480.2,
      exitType: 'Target Hit'
    }
  },
  {
    name: '8. BB TRAP Exit Sell - Exit',
    signal: 'BB TRAP Exit Sell NIFTY1! at 25550.2 | Exit',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'NIFTY1!',
      exitPrice: 25550.2,
      exitType: 'Exit'
    }
  },
  {
    name: '9. BB TRAP Exit - Intraday Exit',
    signal: 'BB TRAP Exit NIFTY1! at 25580.2 | Intraday Exit',
    expected: {
      action: 'exit',
      symbol: 'NIFTY1!',
      exitPrice: 25580.2,
      exitType: 'Intraday Exit'
    }
  },
  {
    name: '10. BB TRAP Exit - End of Day Exit',
    signal: 'BB TRAP Exit NIFTY1! at 25580.2 | End of Day Exit',
    expected: {
      action: 'exit',
      symbol: 'NIFTY1!',
      exitPrice: 25580.2,
      exitType: 'End of Day Exit'
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

