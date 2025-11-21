const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubscriptions() {
  console.log('\n🔍 Checking all subscriptions in database...\n');

  try {
    // Check OptionTrade subscriptions
    const optionTradeSubs = await prisma.optionTradeSubscription.findMany();
    console.log(`📊 OptionTrade Subscriptions: ${optionTradeSubs.length}`);
    optionTradeSubs.forEach((s, i) => {
      console.log(`  ${i + 1}. userID: ${s.userID}`);
      console.log(`     enabled: ${s.enabled}`);
      console.log(`     lotSize: ${s.lotSize}`);
      console.log(`     customSettings:`, s.customSettings);
      console.log('');
    });

    // Check enabled subscriptions only
    const enabledSubs = await prisma.optionTradeSubscription.findMany({
      where: { enabled: true }
    });
    console.log(`✅ Enabled OptionTrade Subscriptions: ${enabledSubs.length}`);
    enabledSubs.forEach((s, i) => {
      console.log(`  ${i + 1}. userID: ${s.userID}, lotSize: ${s.lotSize}`);
    });

    // Check broker accounts
    console.log('\n📊 Broker Accounts:');
    const brokerAccounts = await prisma.brokerAccount.findMany({
      where: { isActive: true }
    });
    console.log(`  Total active: ${brokerAccounts.length}`);
    brokerAccounts.forEach((b, i) => {
      console.log(`  ${i + 1}. userId: ${b.userId}, clientId: ${b.clientId}, clientName: ${b.clientName}`);
    });

    // Check broker tokens
    console.log('\n📊 Broker Tokens:');
    const brokerTokens = await prisma.brokerToken.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    });
    console.log(`  Total active & valid: ${brokerTokens.length}`);
    brokerTokens.forEach((t, i) => {
      console.log(`  ${i + 1}. brokerAccountId: ${t.brokerAccountId}, expiresAt: ${t.expiresAt}`);
    });

    // Now test the actual getSubscribedUsers function
    console.log('\n🧪 Testing getSubscribedUsers function...\n');
    const { getSubscribedUsers } = require('./utils/subscriptionManager');
    const users = await getSubscribedUsers('OptionTrade', 'NIFTY');
    
    console.log(`\n📊 RESULT: ${users.length} users ready for execution`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscriptions();

