// Unit test for Pine Script signal parsing (no server required)

// Copy the parsing function here for testing
function parseBBTrapSignal(messageText) {
  // PINE SCRIPT FORMATS (Priority)
  
  // 1. Pine Script Entry: "BB TRAP Buy/Sell SYMBOL at PRICE | SL: PRICE | Target: PRICE"
  const pineEntryRegex = /BB TRAP (Buy|Sell) (.+?) at ([\d.]+) \| SL: ([\d.]+) \| Target: ([\d.]+)/i;
  const pineEntryMatch = messageText.match(pineEntryRegex);

  if (pineEntryMatch) {
    return {
      action: pineEntryMatch[1].toLowerCase(),
      symbol: pineEntryMatch[2].trim(),
      entryPrice: parseFloat(pineEntryMatch[3]),
      stopLoss: parseFloat(pineEntryMatch[4]),
      target: parseFloat(pineEntryMatch[5]),
    };
  }

  // 2. Pine Script Exit: "BB TRAP Exit Long/Short SYMBOL at PRICE"
  const pineExitRegex = /BB TRAP Exit (Long|Short) (.+?) at ([\d.]+)/i;
  const pineExitMatch = messageText.match(pineExitRegex);

  if (pineExitMatch) {
    const direction = pineExitMatch[1].toLowerCase();
    return {
      action: 'exit',
      originalDirection: direction === 'long' ? 'buy' : 'sell',
      symbol: pineExitMatch[2].trim(),
      exitPrice: parseFloat(pineExitMatch[3]),
      exitType: 'Pine Script Exit',
    };
  }

  // LEGACY FORMATS
  
  // 3. Bear Trap
  const bearTrapRegex = /(.+?)\s*\|\s*Bear Trap\s*\|\s*Entry at\s*([\d.]+)\s*\|\s*SL:\s*([\d.]+)\s*\|\s*Target:\s*([\d.]+)/i;
  const bearTrapMatch = messageText.match(bearTrapRegex);

  if (bearTrapMatch) {
    return {
      action: 'buy',
      symbol: bearTrapMatch[1].trim(),
      entryPrice: parseFloat(bearTrapMatch[2]),
      stopLoss: parseFloat(bearTrapMatch[3]),
      target: parseFloat(bearTrapMatch[4]),
    };
  }

  // 4. Bull Trap
  const bullTrapRegex = /(.+?)\s*\|\s*Bull Trap\s*\|\s*Entry at\s*([\d.]+)\s*\|\s*SL:\s*([\d.]+)\s*\|\s*Target:\s*([\d.]+)/i;
  const bullTrapMatch = messageText.match(bullTrapRegex);

  if (bullTrapMatch) {
    return {
      action: 'sell',
      symbol: bullTrapMatch[1].trim(),
      entryPrice: parseFloat(bullTrapMatch[2]),
      stopLoss: parseFloat(bullTrapMatch[3]),
      target: parseFloat(bullTrapMatch[4]),
    };
  }

  return null;
}

// Test cases
const tests = [
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

console.log('🧪 Testing Pine Script Signal Parsing (Unit Test)\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

tests.forEach(test => {
  console.log(`\n📝 Test: ${test.name}`);
  console.log(`   Signal: "${test.signal}"`);
  
  const result = parseBBTrapSignal(test.signal);
  
  if (!result) {
    console.log(`   ❌ FAILED: No match found`);
    failed++;
    return;
  }
  
  const match = JSON.stringify(result) === JSON.stringify(test.expected);
  
  if (match) {
    console.log(`   ✅ PASSED`);
    console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
    passed++;
  } else {
    console.log(`   ❌ FAILED`);
    console.log(`   Expected: ${JSON.stringify(test.expected, null, 2)}`);
    console.log(`   Got:      ${JSON.stringify(result, null, 2)}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(70));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}/${tests.length}`);
console.log(`   ❌ Failed: ${failed}/${tests.length}`);

if (failed === 0) {
  console.log(`\n🎉 All tests passed!`);
  process.exit(0);
} else {
  console.log(`\n⚠️ Some tests failed.`);
  process.exit(1);
}

