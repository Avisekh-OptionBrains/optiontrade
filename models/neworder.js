const mongoose = require("mongoose");

const orderResponseSchema = new mongoose.Schema({
  clientId: { type: String, required: true }, // Client identifier
  orderType: { type: String, required: true }, // Buy/Sell, etc.
  strategyName: { type: String, required: true }, // Name of the trading strategy
  details: {
    status: { type: Boolean, required: true }, // Order status (true = success)
    message: { type: String }, // Response message
    script: { type: String }, // Script symbol (e.g., WELCORP-EQ)
    orderid: { type: String }, // Broker's order ID
    uniqueorderid: { type: String }, // Unique order identifier
    response: { type: mongoose.Schema.Types.Mixed }, // Complete broker response
    apiKey: { type: String, required: true }, // Client's API key
    jwtToken: { type: String, required: true }, // Client's JWT token
  },
  broker: { type: String, required: true }, // Broker name
  symboltoken: { type: String, required: true }, // Symbol token for the order
  createdAt: { type: Date, default: Date.now }, // Timestamp of record creation
});

// Create the model
const OrderMessage = mongoose.model("OrderMessage", orderResponseSchema);

module.exports = OrderMessage;
