const prisma = require('./prismaClient');

async function checkSubscription() {
  try {
    console.log('🔍 Checking Subscriptions in database...\n');
    
    // Find BankNifty subscriptions
    const bankNiftySubscriptions = await prisma.bankNiftySubscription.findMany({
      where: { enabled: true },
      take: 5
    });
    
    console.log('📊 BankNifty Subscriptions:');
    console.log(JSON.stringify(bankNiftySubscriptions, null, 2));
    
    // Find Epicrise subscriptions
    const epicriseSubscriptions = await prisma.epicriseSubscription.findMany({
      where: { enabled: true },
      take: 5
    });
    
    console.log('\n📊 Epicrise Subscriptions:');
    console.log(JSON.stringify(epicriseSubscriptions, null, 2));
    
    // Find OptionTrade subscriptions
    const optionTradeSubscriptions = await prisma.optionTradeSubscription.findMany({
      where: { enabled: true },
      take: 5
    });
    
    console.log('\n📊 OptionTrade Subscriptions:');
    console.log(JSON.stringify(optionTradeSubscriptions, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscription();

