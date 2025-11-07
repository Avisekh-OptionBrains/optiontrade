const { MongoClient } = require("mongodb");
require("dotenv").config();

const mongoUri = process.env.TESTLIST;
const client = new MongoClient(mongoUri);

async function checkSymbols() {
    try {
        await client.connect();
        console.log('✅ Connected to database');

        // List all databases
        const admin = client.db().admin();
        const databases = await admin.listDatabases();
        console.log('\n📊 Available databases:');
        databases.databases.forEach((db, index) => {
            console.log(`  ${index + 1}. ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });

        // Check EPICRISE database
        const database = client.db("EPICRISE");
        const collections = await database.listCollections().toArray();
        console.log('\n📋 Collections in EPICRISE database:');

        if (collections.length === 0) {
            console.log('  No collections found in EPICRISE database');
        } else {
            for (const collection of collections) {
                const coll = database.collection(collection.name);
                const count = await coll.countDocuments();
                console.log(`  - ${collection.name}: ${count} documents`);

                // Show sample document if exists
                if (count > 0) {
                    const sample = await coll.findOne();
                    console.log(`    Sample document:`, JSON.stringify(sample, null, 2).substring(0, 200) + '...');
                }
            }
        }

        // Check Angel_api database specifically for symbols
        console.log(`\n🔍 Detailed check of Angel_api database:`);
        const angelDb = client.db('Angel_api');
        const totalscriptCollection = angelDb.collection('totalscript');

        // Get equity symbols
        const equitySymbols = await totalscriptCollection.find({
            exch_seg: "NSE",
            symbol: { $regex: "-EQ$" }
        }).limit(10).toArray();

        console.log('\n📋 NSE Equity symbols (-EQ):');
        equitySymbols.forEach((symbol, index) => {
            console.log(`  ${index + 1}. ${symbol.name} (${symbol.symbol}) - Token: ${symbol.token}`);
        });

        // Check for specific test symbols
        const testSymbols = ['TATACHEM', 'RELIANCE', 'INFY', 'SBIN', 'TCS', 'THERMAX'];
        console.log('\n🔍 Checking test symbols in Angel_api:');

        for (const symbolName of testSymbols) {
            const found = await totalscriptCollection.findOne({
                exch_seg: "NSE",
                name: symbolName,
                symbol: { $regex: "-EQ$" }
            });

            if (found) {
                console.log(`✅ ${symbolName}: Found (${found.symbol}) - Token: ${found.token}`);
            } else {
                console.log(`❌ ${symbolName}: Not found`);
            }
        }

        // Get total equity count
        const equityCount = await totalscriptCollection.countDocuments({
            exch_seg: "NSE",
            symbol: { $regex: "-EQ$" }
        });
        console.log(`\n📊 Total NSE Equity symbols: ${equityCount}`);

    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        await client.close();
        console.log('\n✅ Disconnected from database');
    }
}

if (require.main === module) {
    checkSymbols();
}

module.exports = { checkSymbols };
