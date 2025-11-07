const mongoose = require("mongoose");

// Define the schema for storing client data
const clientSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  jwtToken: { type: String, required: true },
  apiKey: { type: String, required: true },
  capital: { type: Number, required: true },
});

// Create the Client model
const Client = mongoose.model("Client", clientSchema);

module.exports = Client;
