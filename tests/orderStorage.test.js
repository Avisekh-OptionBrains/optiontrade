const mongoose = require('mongoose');
const OrderResponse = require('../models/OrderResponse');
const { angelhandleClientOrder } = require('../Strategies/Epicrise/Brokers/AngelOne/AngelUtils');
const { handleClientOrder } = require('../Strategies/Epicrise/Brokers/MotilalOswal/MotilalUtils');

// Test data
const mockDocument = {
    symbol: "SBIN-EQ",
    token: "3045",
    name: "SBIN"
};

const mockAngelClient = {
    clientName: "TestAngelClient",
    jwtToken: "mock-jwt-token",
    apiKey: "mock-api-key",
    capital: 100000
};

const mockMotilalClient = {
    clientName: "TestMotilalClient",
    authToken: "mock-auth-token",
    apiKey: "mock-api-key",
    capital: 100000,
    userId: "TESTUSER"
};

const mockCredentials = {
    localIp: "127.0.0.1",
    publicIp: "127.0.0.1",
    macAddress: "00:00:00:00:00:00"
};

async function runTests() {
    try {
        console.log("🔄 Starting Order Storage Tests...\n");

        // Test 1: Angel One Primary Order Success
        console.log("Test 1: Angel One Primary Order Success");
        await angelhandleClientOrder(
            mockAngelClient,
            mockDocument,
            100.00, // price
            "BUY",  // transactionType
            mockCredentials,
            97.50   // stopLossPrice
        );

        // Verify database entry
        const angelOrder = await OrderResponse.findOne({
            clientName: mockAngelClient.clientName,
            broker: "ANGEL",
            orderType: "PRIMARY"
        });
        console.log("✅ Angel Primary Order stored:", angelOrder ? "Yes" : "No");
        console.log("Order details:", angelOrder);

        // Test 2: Motilal Oswal Primary Order Success
        console.log("\nTest 2: Motilal Oswal Primary Order Success");
        await handleClientOrder(
            mockMotilalClient,
            mockDocument,
            100.00,
            "BUY",
            mockCredentials,
            97.50
        );

        // Verify database entry
        const motilalOrder = await OrderResponse.findOne({
            clientName: mockMotilalClient.clientName,
            broker: "MOTILAL",
            orderType: "PRIMARY"
        });
        console.log("✅ Motilal Primary Order stored:", motilalOrder ? "Yes" : "No");
        console.log("Order details:", motilalOrder);

        // Test 3: Failed Order Storage
        console.log("\nTest 3: Failed Order Storage");
        const invalidClient = { ...mockAngelClient, jwtToken: null };
        await angelhandleClientOrder(
            invalidClient,
            mockDocument,
            100.00,
            "BUY",
            mockCredentials,
            97.50
        );

        // Verify failed order entry
        const failedOrder = await OrderResponse.findOne({
            clientName: invalidClient.clientName,
            status: "FAILED"
        });
        console.log("✅ Failed Order stored:", failedOrder ? "Yes" : "No");
        console.log("Failed order details:", failedOrder);

        console.log("\n✅ All tests completed!");

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

// Connect to test database
mongoose.connect(process.env.TESTLIST)
    .then(() => {
        console.log("Connected to test database");
        return runTests();
    })
    .catch(console.error)
    .finally(() => {
        console.log("\nClosing database connection...");
        mongoose.connection.close();
    });
