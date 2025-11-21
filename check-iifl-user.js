const prisma = require('./prismaClient');

async function checkIIFLUser() {
  try {
    console.log('🔍 Checking IIFLUser in database...\n');
    
    // Find the user
    const user = await prisma.iIFLUser.findFirst({
      where: {
        userID: '2a66c354-2cfa-467c-a14b-da76a6ca13c7'
      }
    });
    
    console.log('📊 IIFLUser Details:');
    console.log(JSON.stringify(user, null, 2));
    
    console.log('\n🔍 Key Fields:');
    console.log(`   userID: ${user?.userID}`);
    console.log(`   clientName: ${user?.clientName}`);
    console.log(`   password: ${user?.password}`);
    console.log(`   token: ${user?.token ? 'YES (length: ' + user.token.length + ')' : 'NO'}`);
    console.log(`   state: ${user?.state}`);
    
    if (user?.password === 'INTEGRATION_MANAGED') {
      console.log('\n⚠️ This is an INTEGRATION-MANAGED user');
      console.log('   Orders will be SIMULATED (not placed on real broker)');
    } else {
      console.log('\n✅ This is a REAL user');
      console.log('   Orders will be placed on real broker');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkIIFLUser();

