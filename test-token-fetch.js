const prisma = require('./prismaClient');

async function testTokenFetch() {
  try {
    console.log('🔍 Testing token fetch logic...\n');

    // Find the user
    const user = await prisma.iIFLUser.findFirst({
      where: { clientName: 'Avisekh ghosh', state: 'live' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:');
    console.log(`   Name: ${user.clientName}`);
    console.log(`   UserID: ${user.userID}`);
    console.log(`   Token: ${user.token ? user.token.substring(0, 20) + '...' : 'NONE'}`);
    console.log(`   Password: ${user.password}\n`);

    // Find broker account
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: {
        clientId: user.userID,
        isActive: true
      }
    });

    console.log(`📊 Broker Account: ${brokerAccount ? 'FOUND' : 'NOT FOUND'}`);
    if (brokerAccount) {
      console.log(`   ID: ${brokerAccount.id}`);
      console.log(`   Name: ${brokerAccount.clientName}\n`);

      // Find broker token
      const brokerToken = await prisma.brokerToken.findFirst({
        where: {
          brokerAccountId: brokerAccount.id,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`🔑 Broker Token: ${brokerToken ? 'FOUND' : 'NOT FOUND'}`);
      if (brokerToken) {
        console.log(`   Token: ${brokerToken.accessToken.substring(0, 20)}...`);
        console.log(`   Expires: ${brokerToken.expiresAt}`);
        console.log(`   Active: ${brokerToken.isActive}`);
      } else {
        console.log('   ⚠️ No active, non-expired token found');
      }
    } else {
      console.log('   ⚠️ No broker account found for this user');
    }

    // Check subscriptions
    console.log('\n📋 Checking subscriptions...');
    const epicriseSubscription = await prisma.epicriseSubscription.findFirst({
      where: { userID: user.userID, enabled: true }
    });

    console.log(`   Epicrise: ${epicriseSubscription ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);
    if (epicriseSubscription) {
      console.log(`      Capital: ₹${epicriseSubscription.capital}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testTokenFetch();

