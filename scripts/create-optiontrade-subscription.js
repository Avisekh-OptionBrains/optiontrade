const prisma = require('../prismaClient');

async function createOptionTradeSubscription() {
  try {
    console.log('🔍 Creating OptionTrade subscription for existing user...\n');
    
    // Get the existing user
    const user = await prisma.iIFLUser.findFirst({
      where: { state: 'live' }
    });
    
    if (!user) {
      console.log('❌ No live users found!');
      return;
    }
    
    console.log(`✅ Found user: ${user.clientName} (${user.userID})\n`);
    
    // Check if OptionTrade subscription already exists
    const existingSub = await prisma.optionTradeSubscription.findFirst({
      where: { userID: user.userID }
    });
    
    if (existingSub) {
      console.log('📊 Existing OptionTrade subscription found:');
      console.log(`   - ID: ${existingSub.id}`);
      console.log(`   - Enabled: ${existingSub.enabled}`);
      console.log(`   - LotSize: ${existingSub.lotSize}`);
      console.log(`   - CustomSettings: ${JSON.stringify(existingSub.customSettings, null, 2)}\n`);
      
      // Update it to be enabled
      const updated = await prisma.optionTradeSubscription.update({
        where: { id: existingSub.id },
        data: {
          enabled: true,
          lotSize: 1,
          customSettings: {
            clientId: user.userID,
            brokerType: 'IIFL',
            subscriptionId: `${user.userID}_optiontrade`
          }
        }
      });
      
      console.log('✅ Updated OptionTrade subscription to enabled!\n');
    } else {
      // Create new subscription
      const newSub = await prisma.optionTradeSubscription.create({
        data: {
          userID: user.userID,
          enabled: true,
          lotSize: 1,
          customSettings: {
            clientId: user.userID,
            brokerType: 'IIFL',
            subscriptionId: `${user.userID}_optiontrade`
          }
        }
      });
      
      console.log('✅ Created new OptionTrade subscription:');
      console.log(`   - ID: ${newSub.id}`);
      console.log(`   - UserID: ${newSub.userID}`);
      console.log(`   - Enabled: ${newSub.enabled}`);
      console.log(`   - LotSize: ${newSub.lotSize}\n`);
    }
    
    // Verify subscription was created
    const allSubs = await prisma.optionTradeSubscription.findMany({
      where: { userID: user.userID }
    });
    
    console.log(`📊 Total OptionTrade subscriptions for user: ${allSubs.length}`);
    allSubs.forEach(sub => {
      console.log(`   - ID: ${sub.id}, Enabled: ${sub.enabled}, LotSize: ${sub.lotSize}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createOptionTradeSubscription();

