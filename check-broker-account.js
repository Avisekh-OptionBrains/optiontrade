const prisma = require('./prismaClient');

async function checkBrokerAccount() {
  try {
    console.log('🔍 Checking BrokerAccount in database...\n');
    
    // Find all broker accounts
    const accounts = await prisma.brokerAccount.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📊 Recent BrokerAccounts:');
    console.log(JSON.stringify(accounts, null, 2));
    
    // Find specific account
    const specific = await prisma.brokerAccount.findFirst({
      where: {
        clientId: '28748327'
      }
    });
    
    console.log('\n🎯 BrokerAccount for clientId 28748327:');
    console.log(JSON.stringify(specific, null, 2));
    
    // Check if it has brokerTokens
    if (specific) {
      const tokens = await prisma.brokerToken.findMany({
        where: {
          brokerAccountId: specific.id
        }
      });
      
      console.log('\n🔑 BrokerTokens for this account:');
      console.log(JSON.stringify(tokens, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBrokerAccount();

