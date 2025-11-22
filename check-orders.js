const prisma = require('./prismaClient');

async function checkOrders() {
  try {
    console.log('\n📊 Checking recent orders from database...\n');

    // Get all recent orders
    const allOrders = await prisma.orderResponse.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    console.log(`Total recent orders: ${allOrders.length}\n`);

    allOrders.forEach((order, index) => {
      console.log(`Order #${index + 1}:`);
      console.log(`  Client: ${order.clientName}`);
      console.log(`  Broker: ${order.broker}`);
      console.log(`  Symbol: ${order.symbol}`);
      console.log(`  Type: ${order.transactionType}`);
      console.log(`  Price: ₹${order.price}`);
      console.log(`  Quantity: ${order.quantity}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Order ID: ${order.orderId || 'N/A'}`);
      console.log(`  Message: ${order.message}`);
      console.log(`  Timestamp: ${order.timestamp}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkOrders();

