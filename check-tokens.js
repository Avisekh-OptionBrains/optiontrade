const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTokens() {
  console.log('\n🔍 Checking all broker tokens...\n');

  try {
    const allTokens = await prisma.brokerToken.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Total Broker Tokens: ${allTokens.length}\n`);

    allTokens.forEach((t, i) => {
      console.log(`${i + 1}. Token ID: ${t.id}`);
      console.log(`   Broker Account ID: ${t.brokerAccountId}`);
      console.log(`   User ID: ${t.userId}`);
      console.log(`   Strategy ID: ${t.strategyId}`);
      console.log(`   Is Active: ${t.isActive}`);
      console.log(`   Expires At: ${t.expiresAt}`);
      console.log(`   Expired: ${t.expiresAt < new Date()}`);
      console.log(`   Created At: ${t.createdAt}`);
      console.log('');
    });

    // Check for specific user
    const userTokens = await prisma.brokerToken.findMany({
      where: {
        userId: '2a66c354-2cfa-467c-a14b-da76a6ca13c7'
      }
    });

    console.log(`\n📊 Tokens for user 2a66c354-2cfa-467c-a14b-da76a6ca13c7: ${userTokens.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTokens();

