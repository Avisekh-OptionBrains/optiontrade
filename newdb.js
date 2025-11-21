// const { MongoClient } = require("mongodb");
// const mongoose = require("mongoose");
// require("dotenv").config();

// const mongoUri = process.env.TESTLIST;
// // MongoDB URI

// // MongoDB client
// const client = new MongoClient(mongoUri);

// async function connectToDatabase() {
//   try {
//     await client.connect();
//     console.log("Database connected successfully");
//   } catch (error) {
//     console.error("Failed to connect to the database:", error);
//   }
// }
// async function initializeDatabaseConnection() {
//   try {
//     await mongoose.connect(mongoUri, {});
//     console.log("Database connected successfully.");
//   } catch (error) {
//     console.error("Failed to connect to the database:", error);
//   }
// }
// async function findSymbolInDatabase(symbol) {
//   try {
//     const database = client.db("EPICRISE");
//     const collection = database.collection("totalscript");

//     // Define query to match both `exch_seg: "NSE"` and `name`
//     const query = {
//       exch_seg: "NSE",
//       name: symbol,
//     };

//     // Log query parameters for debugging
//     // console.log("Searching database with query:", query);

//     const results = await collection.find(query).toArray();

//     if (results.length === 0) {
//       // console.log("No matching document found for symbol:", symbol);
//       return null;
//     }

//     // Iterate over the results and check if the symbol ends with "-EQ"
//     for (let i = 0; i < results.length; i++) {
//       const result = results[i];

//       // If the symbol ends with "-EQ", return the result
//       if (result.symbol && result.symbol.endsWith("-EQ")) {
//         // console.log("Matching document found:", result);
//         return result;
//       } else {
//         console.log(
//           `Found document ${result.symbol}, but symbol does not end with '-EQ'`
//         );
//       }
//     }

//     // If no matching symbol found
//     // console.log("No symbol found ending with '-EQ'");
//     return null;
//   } catch (error) {
//     console.error("Database query error:", error);
//     return null;
//   }
// }
// async function main() {
//   await connectToDatabase();

//   // Use the MongoDB client in your application
//   const db = client.db(); // Get the database

//   // Your application logic here
//   const collection = db.collection("clients");
//   const data = await collection.find({}).toArray();
//   // console.log("Fetched data:", data);
// }

// module.exports = {
//   initializeDatabaseConnection,
//   findSymbolInDatabase,
//   main,
// };

const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");
const prisma = require('./prismaClient')
require("dotenv").config();

const mongoUri = process.env.TESTLIST;

// Only create MongoClient if mongoUri is defined
const client = mongoUri ? new MongoClient(mongoUri) : null;

let isConnected = false;

// Connect using native MongoClient
async function connectToDatabase() {
  if (!client) {
    console.warn("MongoDB URI not configured (TESTLIST env var not set). Skipping MongoDB connection.");
    return;
  }

  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log("MongoDB client connected");
    } catch (error) {
      console.error("MongoDB client connection error:", error);
    }
  }
}

// Connect using Mongoose (for MongoDB models)
async function initializeDatabaseConnection() {
  try {
    await prisma.$connect()
    console.log("Prisma connected to PostgreSQL.")

    // Also connect to MongoDB for symbol lookup
    if (mongoUri) {
      await mongoose.connect(mongoUri, {});
      console.log("Mongoose connected to MongoDB for symbol lookup");
    }
  } catch (error) {
    console.error("Database connection error:", error)
  }
}

async function findSymbolInDatabase(symbol) {
  try {
    if (!client) {
      console.warn("MongoDB not configured. Symbol lookup unavailable.");
      return null;
    }

    await connectToDatabase(); // Ensure client is connected before querying

    // Use Angel_api database for symbol lookup
    const database = client.db("Angel_api");
    const collection = database.collection("totalscript");

    const query = {
      exch_seg: "NSE",
      name: symbol,
    };

    console.log(`🔍 Searching for symbol: ${symbol} in Angel_api database`);
    const results = await collection.find(query).toArray();
    console.log(`📊 Found ${results.length} results for symbol: ${symbol}`);

    for (let result of results) {
      if (result.symbol && result.symbol.endsWith("-EQ")) {
        console.log(`✅ Found matching symbol: ${result.symbol} with token: ${result.token}`);
        return result;
      }
    }

    console.log(`⚠️ No -EQ symbol found for: ${symbol}`);
    return null;
  } catch (error) {
    console.error("❌ Database query error:", error);
    return null;
  }
}

async function main() {
  await initializeDatabaseConnection()

  if (client) {
    console.log("Database connection established for PostgreSQL and MongoDB");

    // Test symbol lookup
    const testSymbol = await findSymbolInDatabase("SBIN");
    if (testSymbol) {
      console.log("✅ Symbol lookup test successful:", testSymbol.symbol);
    } else {
      console.log("⚠️ Symbol lookup test failed");
    }
  } else {
    console.log("Database connection established for PostgreSQL only (MongoDB not configured)");
  }
}

module.exports = {
  initializeDatabaseConnection,
  findSymbolInDatabase,
  main,
}
