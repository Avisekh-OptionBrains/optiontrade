/**
 * Migration Script: Fix Missing lotSize in Subscriptions
 * 
 * This script adds the lotSize field to all existing subscriptions
 * that are missing it (old subscriptions created before the field was added)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const OptionTradeSubscription = require('../models/StrategySubscriptions/OptionTradeSubscription');
const BankNiftySubscription = require('../models/StrategySubscriptions/BankNiftySubscription');

const mongoUri = process.env.TESTLIST;

async function fixSubscriptions() {
  try {
    // Connect to database
    await mongoose.connect(mongoUri, {});
    console.log('✅ Connected to database\n');

    // Fix OptionTrade subscriptions
    console.log('🔧 Fixing OptionTrade subscriptions...');
    const optionTradeResult = await OptionTradeSubscription.updateMany(
      { lotSize: { $exists: false } }, // Find subscriptions without lotSize
      { $set: { lotSize: 1 } } // Set default to 1 lot
    );
    console.log(`   Updated ${optionTradeResult.modifiedCount} OptionTrade subscriptions`);

    // Fix BankNifty subscriptions
    console.log('🔧 Fixing BankNifty subscriptions...');
    const bankNiftyResult = await BankNiftySubscription.updateMany(
      { lotSize: { $exists: false } }, // Find subscriptions without lotSize
      { $set: { lotSize: 1 } } // Set default to 1 lot
    );
    console.log(`   Updated ${bankNiftyResult.modifiedCount} BankNifty subscriptions`);

    // Show all subscriptions
    console.log('\n📊 Current Subscriptions:');
    
    const optionTradeSubs = await OptionTradeSubscription.find({});
    console.log(`\n🎯 OptionTrade (${optionTradeSubs.length}):`);
    optionTradeSubs.forEach(sub => {
      console.log(`   - User ${sub.userID}: ${sub.lotSize} lots (${sub.lotSize * 75} qty)`);
    });

    const bankNiftySubs = await BankNiftySubscription.find({});
    console.log(`\n💰 BankNifty (${bankNiftySubs.length}):`);
    bankNiftySubs.forEach(sub => {
      console.log(`   - User ${sub.userID}: ${sub.lotSize} lots (${sub.lotSize * 35} qty)`);
    });

    console.log('\n✅ Migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSubscriptions();

