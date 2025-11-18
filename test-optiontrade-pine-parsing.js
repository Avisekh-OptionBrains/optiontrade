// Unit test for OptionTrade Pine Script signal parsing (no server required)

// Copy the parsing function here for testing
function parseBBTrapSignal(signalText) {
  // PINE SCRIPT FORMATS (Priority)
  
  // 1. Pine Script Entry: "BB TRAP Buy/Sell SYMBOL at PRICE | SL: PRICE | Target: PRICE"
  const pineEntryRegex = /BB TRAP (Buy|Sell) (.+?) at ([\d.]+) \| SL: ([\d.]+) \| Target: ([\d.]+)/i;
  const pineEntryMatch = signalText.match(pineEntryRegex);

  if (pineEntryMatch) {
    return {
      action: pineEntryMatch[1].toLowerCase(),
      symbol: pineEntryMatch[2].trim(),
      entryPrice: parseFloat(pineEntryMatch[3]),
      stopLoss: parseFloat(pineEntryMatch[4]),
      target: parseFloat(pineEntryMatch[5]),
    };
  }

  // 2. Pine Script Exit: "BB TRAP LONG/SHORT EXIT SYMBOL at PRICE"
  const pineExitRegex = /BB TRAP (LONG|SHORT) EXIT(?:\s+\((.+?)\))?\s+(.+?)\s+at\s+([\d.]+)/i;
  const pineExitMatch = signalText.match(pineExitRegex);

  if (pineExitMatch) {
    const direction = pineExitMatch[1].toLowerCase();
    const exitReason = pineExitMatch[2] || 'Pine Script Exit';
    return {
      action: 'exit',
      originalDirection: direction === 'long' ? 'buy' : 'sell',
      symbol: pineExitMatch[3].trim(),
      exitPrice: parseFloat(pineExitMatch[4]),
      exitType: exitReason,
    };
  }

  // LEGACY FORMATS
  
  // 3. Exit with Direction
  const exitWithDirectionRegex = /BB TRAP Exit (Buy|Sell) (.+?) at ([\d.]+) \| (.+)/i;
  const exitWithDirectionMatch = signalText.match(exitWithDirectionRegex);

  if (exitWithDirectionMatch) {
    return {
      action: 'exit',
      originalDirection: exitWithDirectionMatch[1].toLowerCase(),
      symbol: exitWithDirectionMatch[2].trim(),
      exitPrice: parseFloat(exitWithDirectionMatch[3]),
      exitType: exitWithDirectionMatch[4].trim(),
    };
  }

  // 4. Exit without Direction
  const exitRegex = /BB TRAP Exit (.+?) at ([\d.]+) \| (.+)/i;
  const exitMatch = signalText.match(exitRegex);

  if (exitMatch) {
    return {
      action: 'exit',
      symbol: exitMatch[1].trim(),
      exitPrice: parseFloat(exitMatch[2]),
      exitType: exitMatch[3].trim(),
    };
  }

  return null;
}

// Test cases
const tests = [
  {
    name: 'Pine Script - Buy Entry',
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
    name: 'Pine Script - Sell Entry',
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
    name: 'Pine Script - LONG EXIT (simple)',
    signal: 'BB TRAP LONG EXIT NIFTY1! at 25520.2',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'NIFTY1!',
      exitPrice: 25520.2,
      exitType: 'Pine Script Exit'
    }
  },
  {
    name: 'Pine Script - SHORT EXIT (simple)',
    signal: 'BB TRAP SHORT EXIT NIFTY1! at 25600.2',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'NIFTY1!',
      exitPrice: 25600.2,
      exitType: 'Pine Script Exit'
    }
  },
  {
    name: 'Pine Script - LONG EXIT (3PM Exit)',
    signal: 'BB TRAP LONG EXIT (3PM Exit) NIFTY1! at 25580.2',
    expected: {
      action: 'exit',
      originalDirection: 'buy',
      symbol: 'NIFTY1!',
      exitPrice: 25580.2,
      exitType: '3PM Exit'
    }
  },
  {
    name: 'Pine Script - SHORT EXIT (EOD Exit)',
    signal: 'BB TRAP SHORT EXIT (EOD Exit) NIFTY1! at 25580.2',
    expected: {
      action: 'exit',
      originalDirection: 'sell',
      symbol: 'NIFTY1!',
      exitPrice: 25580.2,
      exitType: 'EOD Exit'
    }
  },
  {
    name: 'Legacy - Exit Buy with SL Hit',
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
    name: 'Legacy - Exit without Direction',
    signal: 'BB TRAP Exit NIFTY1! at 25580.2 | Intraday Exit',
    expected: {
      action: 'exit',
      symbol: 'NIFTY1!',
      exitPrice: 25580.2,
      exitType: 'Intraday Exit'
    }
  }
];

console.log('🧪 Testing OptionTrade Pine Script Signal Parsing (Unit Test)\n');
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

