const prisma = require('../prismaClient');

async function checkSubscriptions() {
  try {
    console.log('🔍 Checking database for users and subscriptions...\n');
    
    // Check IIFLUser
    const users = await prisma.iIFLUser.findMany();
    console.log(`📊 Total IIFL Users: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.clientName} (${user.userID}) - State: ${user.state}, Password: ${user.password === 'INTEGRATION_MANAGED' ? 'INTEGRATION_MANAGED' : 'REAL'}`);
    });
    
    console.log('\n');
    
    // Check Epic Rise Subscriptions
    const epicSubs = await prisma.epicriseSubscription.findMany();
    console.log(`📈 Epic Rise Subscriptions: ${epicSubs.length}`);
    epicSubs.forEach(sub => {
      console.log(`   - UserID: ${sub.userID}, Enabled: ${sub.enabled}, Capital: ₹${sub.capital}`);
    });
    
    console.log('\n');
    
    // Check Option Trade Subscriptions
    const optionSubs = await prisma.optionTradeSubscription.findMany();
    console.log(`📊 Option Trade Subscriptions: ${optionSubs.length}`);
    optionSubs.forEach(sub => {
      console.log(`   - UserID: ${sub.userID}, Enabled: ${sub.enabled}, LotSize: ${sub.lotSize}`);
    });
    
    console.log('\n');
    
    // Check Bank Nifty Subscriptions
    const bankSubs = await prisma.bankNiftySubscription.findMany();
    console.log(`🏦 Bank Nifty Subscriptions: ${bankSubs.length}`);
    bankSubs.forEach(sub => {
      console.log(`   - UserID: ${sub.userID}, Enabled: ${sub.enabled}, LotSize: ${sub.lotSize}`);
    });
    
    console.log('\n');
    
    // Check for mismatches
    console.log('🔍 Checking for mismatches...\n');
    
    for (const user of users) {
      const hasEpic = epicSubs.some(s => s.userID === user.userID && s.enabled);
      const hasOption = optionSubs.some(s => s.userID === user.userID && s.enabled);
      const hasBank = bankSubs.some(s => s.userID === user.userID && s.enabled);
      
      if (!hasEpic && !hasOption && !hasBank) {
        console.log(`⚠️  User ${user.clientName} (${user.userID}) has NO active subscriptions!`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscriptions();

