const prisma = require('../prismaClient');

async function testLotConfiguration() {
  try {
    console.log('🧪 Testing Lot Configuration Flow...\n');
    
    // Get the existing user
    const user = await prisma.iIFLUser.findFirst({
      where: { state: 'live' }
    });
    
    if (!user) {
      console.log('❌ No live users found!');
      return;
    }
    
    console.log(`✅ Found user: ${user.clientName} (${user.userID})\n`);
    
    // Check OptionTrade subscription
    const optionSub = await prisma.optionTradeSubscription.findFirst({
      where: { userID: user.userID }
    });
    
    console.log('📊 BEFORE Configuration:');
    if (optionSub) {
      console.log(`   OptionTrade Subscription:`);
      console.log(`   - ID: ${optionSub.id}`);
      console.log(`   - Enabled: ${optionSub.enabled}`);
      console.log(`   - LotSize: ${optionSub.lotSize}`);
      console.log(`   - CustomSettings: ${JSON.stringify(optionSub.customSettings, null, 2)}\n`);
    } else {
      console.log('   ❌ No OptionTrade subscription found\n');
    }
    
    // Simulate configuration update (like frontend would do)
    console.log('🔄 Simulating configuration update with lotSize = 2...\n');
    
    const updated = await prisma.optionTradeSubscription.updateMany({
      where: { userID: user.userID },
      data: {
        lotSize: 2,
        customSettings: {
          strategyId: 'brain_wave_nifty_001',
          brokerType: 'IIFL',
          brokerClientId: user.userID,
          brokerClientName: user.clientName,
          capitalPerTrade: 0,
          allocatedCapital: 0,
          lotSize: 2
        }
      }
    });
    
    console.log(`✅ Updated ${updated.count} subscriptions\n`);
    
    // Verify update
    const verifyOption = await prisma.optionTradeSubscription.findFirst({
      where: { userID: user.userID }
    });
    
    console.log('📊 AFTER Configuration:');
    console.log(`   OptionTrade Subscription:`);
    console.log(`   - ID: ${verifyOption.id}`);
    console.log(`   - Enabled: ${verifyOption.enabled}`);
    console.log(`   - LotSize: ${verifyOption.lotSize}`);
    console.log(`   - CustomSettings: ${JSON.stringify(verifyOption.customSettings, null, 2)}\n`);
    
    // Test subscription manager
    console.log('🔍 Testing Subscription Manager...\n');
    const { getSubscribedUsers } = require('../utils/subscriptionManager');
    
    const subscribedUsers = await getSubscribedUsers('OptionTrade', 'NIFTY1!');
    
    console.log(`✅ Found ${subscribedUsers.length} subscribed users for OptionTrade\n`);
    subscribedUsers.forEach(u => {
      console.log(`   User: ${u.clientName}`);
      console.log(`   - LotSize: ${u.subscription.lotSize}`);
      console.log(`   - Quantity: ${u.subscription.quantity}`);
      console.log(`   - Token: ${u.token.substring(0, 20)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLotConfiguration();

