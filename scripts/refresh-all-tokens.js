#!/usr/bin/env node

/**
 * 🔐 IIFL Token Refresh Script
 * Refreshes tokens for all IIFL users in the database
 * 
 * Usage:
 *   node scripts/refresh-all-tokens.js
 *   node scripts/refresh-all-tokens.js --user <userID>
 *   node scripts/refresh-all-tokens.js --verbose
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models and utilities
const IIFLUser = require('../models/IIFLUser');
const { loginWithCredentials } = require('../Strategies/Epicrise/Brokers/IIFL/loginUtils');

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const userIdArg = args.includes('--user') ? args[args.indexOf('--user') + 1] : null;

async function refreshTokenForUser(userData) {
  try {
    const { userID, appKey, appSecret, clientName, password, totpSecret } = userData;

    if (!password || password === 'INTEGRATION_MANAGED') {
      console.log(`⏭️  Skipping ${clientName} (${userID}) - Integration-managed user`);
      return { success: false, skipped: true, reason: 'Integration-managed user' };
    }

    console.log(`\n🔄 Refreshing token for: ${clientName} (${userID})`);

    if (verbose) {
      console.log(`   📝 AppKey: ${appKey ? appKey.substring(0, 10) + '...' : 'MISSING'}`);
      console.log(`   🔐 TOTP Secret: ${totpSecret ? 'PROVIDED' : 'MISSING'}`);
    }

    // Prepare credentials
    const userCredentials = {
      userID,
      password,
      appKey,
      appSecret,
      totpSecret
    };

    // Attempt login
    const loginResult = await loginWithCredentials(userCredentials);

    if (loginResult && loginResult.success && loginResult.accessToken) {
      const token = loginResult.accessToken;
      const tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000);

      // Update user record
      userData.token = token;
      userData.tokenValidity = tokenValidity;
      userData.lastLoginTime = new Date();
      userData.loginStatus = 'success';
      userData.tradingStatus = 'active';

      await userData.save();

      console.log(`✅ Token refreshed successfully for ${userID}`);
      if (verbose) {
        console.log(`   🔑 Token: ${token.substring(0, 20)}...`);
        console.log(`   📅 Valid until: ${tokenValidity.toLocaleString()}`);
      }

      return { success: true, userID, clientName };
    } else {
      throw new Error(loginResult?.error || 'Unknown login error');
    }
  } catch (error) {
    console.error(`❌ Failed to refresh token for ${userData.clientName}:`, error.message);
    return { success: false, userID: userData.userID, error: error.message };
  }
}

async function refreshAllTokens() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         🔐 IIFL TOKEN REFRESH SCRIPT                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trading');
    console.log('✅ Connected to MongoDB\n');

    // Fetch users
    let users;
    if (userIdArg) {
      console.log(`🔍 Fetching user: ${userIdArg}`);
      users = await IIFLUser.find({ userID: userIdArg });
    } else {
      console.log('🔍 Fetching all IIFL users...');
      users = await IIFLUser.find();
    }

    if (!users || users.length === 0) {
      console.log('⚠️  No IIFL users found in database');
      return;
    }

    console.log(`📊 Found ${users.length} user(s) to process\n`);
    console.log('═'.repeat(60) + '\n');

    // Process each user
    const results = [];
    for (const userData of users) {
      const result = await refreshTokenForUser(userData);
      results.push(result);
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 REFRESH SUMMARY:\n');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Total: ${results.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed Users:');
      results.filter(r => !r.success && !r.skipped).forEach(r => {
        console.log(`   - ${r.userID}: ${r.error}`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Token refresh completed!\n');

  } catch (error) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB\n');
  }
}

// Run the script
refreshAllTokens();

