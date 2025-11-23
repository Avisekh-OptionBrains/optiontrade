// File: models/MOUser.js
const mongoose = require("mongoose");

// Define the user schema
const MOuserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    password: { type: String, required: true },
    apiKey: { type: String, required: true },
    twoFA: { type: String, required: true },
    totpKey: { type: String, required: true },
    clientName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    authToken: { type: String, required: false },
    capital: { type: Number, required: true },
  },
  { timestamps: true }
);

// Create the model based on the schema
const MOUser = mongoose.model("motilaluser", MOuserSchema);

module.exports = MOUser;
