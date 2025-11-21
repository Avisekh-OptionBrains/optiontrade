const prisma = require('./prismaClient');

async function testCompleteFlow() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 COMPLETE SYSTEM FLOW TEST');
    console.log('='.repeat(80));

    // 1. Check BrokerAccount
    console.log('\n📋 Step 1: Checking BrokerAccount...');
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: { clientId: '28748327', isActive: true }
    });
    console.log(`   ✅ BrokerAccount: ${brokerAccount ? 'FOUND' : 'NOT FOUND'}`);
    if (brokerAccount) {
      console.log(`      ID: ${brokerAccount.id}`);
      console.log(`      clientId: ${brokerAccount.clientId}`);
      console.log(`      clientName: ${brokerAccount.clientName}`);
    }

    // 2. Check BrokerToken
    console.log('\n📋 Step 2: Checking BrokerToken...');
    const brokerToken = await prisma.brokerToken.findFirst({
      where: {
        brokerAccountId: brokerAccount?.id,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    });
    console.log(`   ✅ BrokerToken: ${brokerToken ? 'FOUND' : 'NOT FOUND'}`);
    if (brokerToken) {
      console.log(`      Token Length: ${brokerToken.accessToken.length} chars`);
      console.log(`      Expires: ${brokerToken.expiresAt}`);
    }

    // 3. Check IIFLUser
    console.log('\n📋 Step 3: Checking IIFLUser...');
    const iiflUser = await prisma.iIFLUser.findFirst({
      where: { userID: '2a66c354-2cfa-467c-a14b-da76a6ca13c7' }
    });
    console.log(`   ✅ IIFLUser: ${iiflUser ? 'FOUND' : 'NOT FOUND'}`);
    if (iiflUser) {
      console.log(`      clientName: ${iiflUser.clientName}`);
      console.log(`      password: ${iiflUser.password}`);
      console.log(`      hasToken: ${!!iiflUser.token}`);
      console.log(`      state: ${iiflUser.state}`);
    }

    // 4. Check Subscriptions
    console.log('\n📋 Step 4: Checking Subscriptions...');
    const epicSub = await prisma.epicriseSubscription.findFirst({
      where: { userID: '2a66c354-2cfa-467c-a14b-da76a6ca13c7', enabled: true }
    });
    console.log(`   ✅ Epicrise: ${epicSub ? 'ENABLED' : 'DISABLED'}`);

    const bankSub = await prisma.bankNiftySubscription.findFirst({
      where: { userID: '2a66c354-2cfa-467c-a14b-da76a6ca13c7', enabled: true }
    });
    console.log(`   ✅ BankNifty: ${bankSub ? 'ENABLED' : 'DISABLED'}`);

    const optionSub = await prisma.optionTradeSubscription.findFirst({
      where: { userID: '2a66c354-2cfa-467c-a14b-da76a6ca13c7', enabled: true }
    });
    console.log(`   ✅ OptionTrade: ${optionSub ? 'ENABLED' : 'DISABLED'}`);

    // 5. Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ SYSTEM STATUS');
    console.log('='.repeat(80));
    const allGood = brokerAccount && brokerToken && iiflUser && epicSub && bankSub && optionSub;
    if (allGood) {
      console.log('✅ ALL SYSTEMS OPERATIONAL');
      console.log('   - BrokerAccount: ✅');
      console.log('   - BrokerToken: ✅');
      console.log('   - IIFLUser: ✅');
      console.log('   - Subscriptions: ✅');
      console.log('\n🚀 System is ready for trading!');
    } else {
      console.log('❌ SOME SYSTEMS NOT READY');
      console.log(`   - BrokerAccount: ${brokerAccount ? '✅' : '❌'}`);
      console.log(`   - BrokerToken: ${brokerToken ? '✅' : '❌'}`);
      console.log(`   - IIFLUser: ${iiflUser ? '✅' : '❌'}`);
      console.log(`   - Subscriptions: ${epicSub && bankSub && optionSub ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow();

