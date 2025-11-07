// File: models/ShareKhanUser.js
const mongoose = require("mongoose");

// Define the ShareKhan user schema
const ShareKhanUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    clientName: { type: String, required: true },
    // ShareKhan API credentials (no password needed)
    userId: { type: String, required: true }, // ShareKhan User ID for login
    apiKey: { type: String, required: true },
    vendorKey: { type: String, required: false }, // Optional vendor key
    // Generated tokens (will be updated via manual process)
    accessToken: { type: String, required: false },
    requestToken: { type: String, required: false },
    // Trading configuration
    capital: { type: Number, required: true },
    state: { type: String, default: "live" },
    // Additional ShareKhan specific fields
    tokenValidity: { type: Date, required: false },
    lastTokenUpdate: { type: Date, required: false },
    tradingStatus: { type: String, default: "active" },
    tokenStatus: { type: String, default: "pending" }, // pending, active, expired
  },
  { timestamps: true }
);

// Create the model based on the schema
const ShareKhanUser = mongoose.model("sharekhanuser", ShareKhanUserSchema);

module.exports = ShareKhanUser;
