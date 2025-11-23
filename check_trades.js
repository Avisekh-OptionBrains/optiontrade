const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function checkTrades() {
  try {
    // Try MONGODB_URI first, then TESTLIST
    const mongoUri = process.env.MONGODB_URI || process.env.TESTLIST;
    
    if (!mongoUri) {
      console.error('❌ No MongoDB URI found in environment variables');
      console.log('Please set MONGODB_URI or TESTLIST in .env file');
      return;
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Import Trade model
    const Trade = require('./models/Trade');

    // Get all trades
    console.log('📊 Fetching all trades...');
    const allTrades = await Trade.find({}).sort({ createdAt: -1 });
    console.log(`Total trades in database: ${allTrades.length}\n`);

    if (allTrades.length === 0) {
      console.log('⚠️  No trades found in database!');
      console.log('This is why exit signals cannot find active trades.\n');
      return;
    }

    // Get today's trades
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTrades = await Trade.find({
      createdAt: { $gte: todayStart }
    }).sort({ createdAt: -1 });

    console.log(`📅 Today's trades: ${todayTrades.length}\n`);

    // Get active trades
    const activeTrades = await Trade.find({
      status: 'ACTIVE'
    }).sort({ createdAt: -1 });

    console.log(`🟢 Active trades: ${activeTrades.length}\n`);

    // Get today's active trades
    const todayActiveTrades = await Trade.find({
      status: 'ACTIVE',
      createdAt: { $gte: todayStart }
    }).sort({ createdAt: -1 });

    console.log(`🎯 Today's active trades: ${todayActiveTrades.length}\n`);

    // Show details of all trades
    if (allTrades.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('TRADE DETAILS:');
      console.log('═══════════════════════════════════════════════════════════\n');

      allTrades.forEach((trade, index) => {
        console.log(`Trade #${index + 1}:`);
        console.log(`  ID: ${trade._id}`);
        console.log(`  Strategy: ${trade.strategy}`);
        console.log(`  Symbol: ${trade.signal?.symbol || 'N/A'}`);
        console.log(`  Action: ${trade.signal?.action || 'N/A'}`);
        console.log(`  Status: ${trade.status}`);
        console.log(`  Created: ${trade.createdAt}`);
        console.log(`  Orders: ${trade.orders?.length || 0}`);
        if (trade.orders && trade.orders.length > 0) {
          trade.orders.forEach((order, i) => {
            console.log(`    ${i + 1}. ${order.action} ${order.type} Strike ${order.strike}`);
          });
        }
        console.log('');
      });
    }

    // Check for NIFTY trades specifically
    console.log('═══════════════════════════════════════════════════════════');
    console.log('NIFTY TRADES:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const niftyPattern = /^NIFTY(1!)?$/i;
    const niftyTrades = await Trade.find({
      'signal.symbol': niftyPattern
    }).sort({ createdAt: -1 });

    console.log(`Total NIFTY trades: ${niftyTrades.length}\n`);

    if (niftyTrades.length > 0) {
      niftyTrades.forEach((trade, index) => {
        console.log(`NIFTY Trade #${index + 1}:`);
        console.log(`  Symbol: ${trade.signal?.symbol}`);
        console.log(`  Action: ${trade.signal?.action}`);
        console.log(`  Status: ${trade.status}`);
        console.log(`  Created: ${trade.createdAt}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

checkTrades();

