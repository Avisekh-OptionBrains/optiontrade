// Script to check BankNifty IIFL setup
require('dotenv').config();
const mongoose = require('mongoose');
const IIFLUser = require('./models/IIFLUser');
const BankNiftySubscription = require('./models/StrategySubscriptions/BankNiftySubscription');

const mongoUri = process.env.TESTLIST;

async function checkBankNiftySetup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {});
    console.log('✅ Connected to MongoDB\n');

    // Check IIFL Users
    console.log('📊 CHECKING IIFL USERS:');
    const iiflusers = await IIFLUser.find({ state: 'live' });
    console.log(`Total live IIFL users: ${iiflusers.length}\n`);
    
    if (iiflusers.length > 0) {
      iiflusers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.clientName} (${user.userID})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   State: ${user.state}`);
        console.log(`   Has Token: ${!!user.token ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   Token: ${user.token ? user.token.substring(0, 20) + '...' : 'N/A'}`);
        console.log(`   Login Status: ${user.loginStatus || 'N/A'}`);
        console.log(`   Last Login: ${user.lastLoginTime || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ No live IIFL users found!\n');
    }

    // Check BankNifty Subscriptions
    console.log('\n📊 CHECKING BANKNIFTY SUBSCRIPTIONS:');
    const subscriptions = await BankNiftySubscription.find({});
    console.log(`Total BankNifty subscriptions: ${subscriptions.length}\n`);
    
    if (subscriptions.length > 0) {
      for (const sub of subscriptions) {
        console.log(`UserID: ${sub.userID}`);
        console.log(`   Enabled: ${sub.enabled ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   Lot Size: ${sub.lotSize} lots`);
        console.log(`   Allowed Symbols: ${sub.allowedSymbols.join(', ')}`);
        console.log(`   Total Trades: ${sub.totalTrades}`);
        console.log(`   Last Trade: ${sub.lastTradeDate || 'Never'}`);
        
        // Check if user exists
        const user = await IIFLUser.findOne({ userID: sub.userID, state: 'live' });
        if (user) {
          console.log(`   ✅ User found: ${user.clientName}`);
          console.log(`   ✅ Has Token: ${!!user.token ? 'YES' : 'NO'}`);
        } else {
          console.log(`   ❌ User NOT found or not live!`);
        }
        console.log('');
      }
    } else {
      console.log('❌ No BankNifty subscriptions found!\n');
    }

    // Check enabled subscriptions with live users
    console.log('\n📊 CHECKING ENABLED SUBSCRIPTIONS WITH LIVE USERS:');
    const enabledSubs = await BankNiftySubscription.find({ enabled: true });
    console.log(`Enabled subscriptions: ${enabledSubs.length}\n`);
    
    let validCount = 0;
    for (const sub of enabledSubs) {
      const user = await IIFLUser.findOne({ userID: sub.userID, state: 'live' });
      if (user && user.token) {
        validCount++;
        console.log(`✅ ${user.clientName} - Ready for trading`);
        console.log(`   Lot Size: ${sub.lotSize} lots (${sub.lotSize * 35} qty)`);
      } else if (user && !user.token) {
        console.log(`⚠️ ${user.clientName} - User exists but NO TOKEN`);
      } else {
        console.log(`❌ UserID ${sub.userID} - User not found or not live`);
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total IIFL Users (live): ${iiflusers.length}`);
    console.log(`   Users with tokens: ${iiflusers.filter(u => u.token).length}`);
    console.log(`   Total BankNifty Subscriptions: ${subscriptions.length}`);
    console.log(`   Enabled Subscriptions: ${enabledSubs.length}`);
    console.log(`   Valid (enabled + live user + token): ${validCount}`);
    
    if (validCount === 0) {
      console.log('\n❌ NO VALID USERS FOR BANKNIFTY TRADING!');
      console.log('   Possible issues:');
      console.log('   1. No BankNifty subscriptions created');
      console.log('   2. Subscriptions are disabled');
      console.log('   3. Users don\'t have valid tokens');
      console.log('   4. Users are not in "live" state');
    } else {
      console.log(`\n✅ ${validCount} user(s) ready for BankNifty trading!`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBankNiftySetup();

