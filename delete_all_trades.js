const mongoose = require("mongoose");
require("dotenv").config();

const Trade = require("./models/Trade");

async function deleteAllTrades() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    const mongoUri = process.env.TESTLIST;

    if (!mongoUri) {
      console.error("❌ TESTLIST not found in .env file!");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Count trades before deletion
    const countBefore = await Trade.countDocuments();
    console.log(`📊 Total trades in database: ${countBefore}`);

    if (countBefore === 0) {
      console.log("✅ Database is already empty!");
      await mongoose.connection.close();
      return;
    }

    // Show breakdown
    const activeCount = await Trade.countDocuments({ status: 'ACTIVE' });
    const completedCount = await Trade.countDocuments({ status: 'COMPLETED' });
    const failedCount = await Trade.countDocuments({ status: 'FAILED' });

    console.log(`   - ACTIVE: ${activeCount}`);
    console.log(`   - COMPLETED: ${completedCount}`);
    console.log(`   - FAILED: ${failedCount}`);

    console.log("\n🗑️  Deleting all trades...");
    const result = await Trade.deleteMany({});
    
    console.log(`✅ Deleted ${result.deletedCount} trades successfully!\n`);

    // Verify deletion
    const countAfter = await Trade.countDocuments();
    console.log(`📊 Trades remaining: ${countAfter}`);

    if (countAfter === 0) {
      console.log("✅ Database is now clean - ready for fresh start! 🎉\n");
    } else {
      console.log("⚠️  Warning: Some trades still remain in database\n");
    }

    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deleteAllTrades();

