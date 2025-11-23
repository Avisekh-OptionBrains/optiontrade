const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Angeluser = require('./models/Angeluser');
const MOUser = require('./models/MOUser');
const OrderResponse = require('./models/OrderResponse');
const OrderModel = require('./models/orderModel');

async function checkDatabase() {
    try {
        // Connect to database
        await mongoose.connect(process.env.TESTLIST);
        console.log('✅ Connected to database');

        // Check Angel users
        console.log('\n📊 Checking Angel Users...');
        const angelUsers = await Angeluser.find();
        console.log(`Found ${angelUsers.length} Angel users`);
        
        if (angelUsers.length > 0) {
            console.log('Angel users:');
            angelUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.clientName} (${user.userId})`);
                console.log(`     - Has JWT Token: ${!!user.jwtToken}`);
                console.log(`     - Has API Key: ${!!user.apiKey}`);
                console.log(`     - Capital: ${user.capital}`);
                console.log(`     - State: ${user.state}`);
            });
        }

        // Check Motilal users
        console.log('\n📊 Checking Motilal Users...');
        const motilalUsers = await MOUser.find();
        console.log(`Found ${motilalUsers.length} Motilal users`);
        
        if (motilalUsers.length > 0) {
            console.log('Motilal users:');
            motilalUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.clientName} (${user.userId})`);
                console.log(`     - Has Auth Token: ${!!user.authToken}`);
                console.log(`     - Has API Key: ${!!user.apiKey}`);
                console.log(`     - Capital: ${user.capital}`);
            });
        }

        // Check recent orders
        console.log('\n📊 Checking Recent Orders...');
        const recentOrders = await OrderResponse.find().sort({ timestamp: -1 }).limit(5);
        console.log(`Found ${recentOrders.length} recent orders`);
        
        if (recentOrders.length > 0) {
            console.log('Recent orders:');
            recentOrders.forEach((order, index) => {
                console.log(`  ${index + 1}. ${order.clientName} - ${order.broker} - ${order.symbol} - ${order.status}`);
            });
        }

        // Check recent messages
        console.log('\n📊 Checking Recent Messages...');
        const recentMessages = await OrderModel.find().sort({ createdAt: -1 }).limit(5);
        console.log(`Found ${recentMessages.length} recent messages`);
        
        if (recentMessages.length > 0) {
            console.log('Recent messages:');
            recentMessages.forEach((message, index) => {
                console.log(`  ${index + 1}. ${message.symbol} - ${message.transactionType} - ${message.price}`);
            });
        }

        // Summary
        console.log('\n📋 Summary:');
        console.log(`- Angel Users: ${angelUsers.length}`);
        console.log(`- Motilal Users: ${motilalUsers.length}`);
        console.log(`- Recent Orders: ${recentOrders.length}`);
        console.log(`- Recent Messages: ${recentMessages.length}`);

        if (angelUsers.length === 0 && motilalUsers.length === 0) {
            console.log('\n⚠️  WARNING: No users found in database!');
            console.log('   This means orders cannot be placed to any broker.');
            console.log('   Please add users using the web interface or API endpoints.');
        }

    } catch (error) {
        console.error('❌ Database check failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from database');
    }
}

// Run if executed directly
if (require.main === module) {
    checkDatabase();
}

module.exports = { checkDatabase };
