const mongoose = require("mongoose");

// Define the schema for storing order information
const orderSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    symbol: { type: String, required: true },
    transactionType: { type: String, required: true },
    message: { type: String, required: true },
    price: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // Automatically add `createdAt` and `updatedAt` fields
  }
);

// Create a model from the schema
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
