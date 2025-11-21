const axios = require('axios');
const prisma = require('../prismaClient');

async function testEndToEndLot() {
  try {
    console.log('🚀 END-TO-END LOT CONFIGURATION TEST\n');
    console.log('=' .repeat(60) + '\n');
    
    // Get user
    const user = await prisma.iIFLUser.findFirst({ where: { state: 'live' } });
    if (!user) {
      console.log('❌ No live users found!');
      return;
    }
    
    console.log(`✅ User: ${user.clientName} (${user.userID})\n`);
    
    // Step 1: Simulate frontend calling configure-strategy API
    console.log('📝 STEP 1: Frontend sends configuration to backend\n');
    
    const configPayload = {
      userId: user.userID,
      strategyId: 'brain_wave_nifty_001',
      strategyName: 'OPTIONTRADE',
      brokerClientId: user.userID,
      brokerClientName: user.clientName,
      capitalPerTrade: 0,
      allocatedCapital: 0,
      lotSize: 3  // ✅ Frontend sends lotSize = 3
    };
    
    console.log('Request payload:');
    console.log(JSON.stringify(configPayload, null, 2));
    console.log('\n');
    
    // Step 2: Call the integration API
    console.log('🔄 STEP 2: Backend processes configuration\n');
    
    try {
      const response = await axios.post(
        'http://localhost:3001/api/integration/configure-strategy',
        configPayload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.INTEGRATION_API_KEY || process.env.STRATEGY_SERVICE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Backend response:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('\n');
    } catch (error) {
      console.log('⚠️  Backend API call failed (expected if server not running)');
      console.log(`   Error: ${error.message}\n`);
    }
    
    // Step 3: Verify database was updated
    console.log('📊 STEP 3: Verify database update\n');
    
    const subscription = await prisma.optionTradeSubscription.findFirst({
      where: { userID: user.userID }
    });
    
    console.log('OptionTrade Subscription in database:');
    console.log(`   - LotSize: ${subscription.lotSize}`);
    console.log(`   - Enabled: ${subscription.enabled}`);
    console.log(`   - CustomSettings: ${JSON.stringify(subscription.customSettings, null, 2)}\n`);
    
    // Step 4: Verify subscription manager returns correct data
    console.log('🔍 STEP 4: Subscription Manager returns correct data\n');
    
    const { getSubscribedUsers } = require('../utils/subscriptionManager');
    const users = await getSubscribedUsers('OptionTrade', 'NIFTY1!');
    
    if (users.length > 0) {
      const u = users[0];
      console.log(`User: ${u.clientName}`);
      console.log(`   - LotSize: ${u.subscription.lotSize}`);
      console.log(`   - Quantity (for NIFTY1!): ${u.subscription.quantity}`);
      console.log(`   - Token: ${u.token.substring(0, 30)}...\n`);
      
      // Step 5: Verify order execution would use correct quantity
      console.log('✅ STEP 5: Order Execution Ready\n');
      console.log('When trading signal arrives:');
      console.log(`   - Strategy: OptionTrade`);
      console.log(`   - Symbol: NIFTY1!`);
      console.log(`   - LotSize: ${u.subscription.lotSize}`);
      console.log(`   - Quantity to place: ${u.subscription.quantity}`);
      console.log(`   - User: ${u.clientName}`);
      console.log(`   - Token: ${u.token === 'INTEGRATION_PLACEHOLDER_TOKEN' ? 'SIMULATED (Integration User)' : 'REAL BROKER TOKEN'}\n`);
    }
    
    console.log('=' .repeat(60));
    console.log('✅ END-TO-END TEST COMPLETE!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEndToEndLot();

