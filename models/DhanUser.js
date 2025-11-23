// File: models/DhanUser.js
const mongoose = require("mongoose");

// Define the Dhan user schema
const DhanUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    clientName: { type: String, required: true },
    dhanClientId: { type: String, required: true },
    jwtToken: { type: String, required: true },
    capital: { type: Number, required: true },
    tokenValidity: { type: String, required: false },
    activeSegment: { type: String, required: false },
    ddpi: { type: String, required: false },
    mtf: { type: String, required: false },
    dataPlan: { type: String, required: false },
    dataValidity: { type: String, required: false },
    state: { type: String, default: "live" },
  },
  { timestamps: true }
);

// Create the model based on the schema
const DhanUser = mongoose.model("dhanuser", DhanUserSchema);

module.exports = DhanUser;
