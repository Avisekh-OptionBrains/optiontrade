const mongoose = require("mongoose");

// Define the IIFL user schema - MAIN MODEL (Login & Token Management)
const IIFLUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    clientName: { type: String, required: true },
    // IIFL API credentials (New format - all required)
    userID: { type: String, required: true, unique: true }, // IIFL Client ID (e.g., "28748327")
    password: { type: String, required: true }, // IIFL trading password
    appKey: { type: String, required: true }, // IIFL App Key
    appSecret: { type: String, required: true }, // IIFL App Secret
    totpSecret: { type: String, required: true }, // TOTP Secret for 2FA
    // Generated tokens (will be updated by cron job)
    token: { type: String, required: false }, // Session token from login - SHARED BY ALL STRATEGIES
    // Trading configuration (DEPRECATED - use strategy-specific models)
    capital: { type: Number, required: false }, // Kept for backward compatibility
    state: { type: String, default: "live" }, // live, paused, disabled
    // Additional IIFL specific fields
    tokenValidity: { type: Date, required: false },
    lastLoginTime: { type: Date, required: false },
    tradingStatus: { type: String, default: "active" },
    loginStatus: { type: String, default: "pending" }, // pending, success, failed
    // User profile data from IIFL
    isInvestorClient: { type: Boolean, required: false },
    clientType: { type: String, required: false },
    exchangeList: { type: Array, required: false },
  },
  { timestamps: true }
);

// Create the model
const IIFLUser = mongoose.model("IIFLUser", IIFLUserSchema);

module.exports = IIFLUser;
