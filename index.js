const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Import routes
const epicriseRouter = require("./Strategies/Epicrise");
const telegramRouter = require("./Strategies/Epicrise/Utils/telegram");
const orderResponsesRouter = require("./routes/orderResponses");

// Routes
app.use("/api/epicrise", epicriseRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/order-responses", orderResponsesRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
