// File: models/MOUser.js
const mongoose = require("mongoose");

// Define the user schema
const Angelschema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    password: { type: String, required: true },
    apiKey: { type: String, required: true },

    totpKey: { type: String, required: true },
    clientName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    jwtToken: { type: String, required: false },
    refreshToken: { type: String, required: false },
    feedToken: { type: String, required: false },
    state: { type: String, default: "live" },
    capital: { type: Number, required: true },
  },
  { timestamps: true }
);

// Create the model based on the schema
const Angeluser = mongoose.model("Angelclient", Angelschema);

module.exports = Angeluser;
