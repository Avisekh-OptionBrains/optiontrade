const mongoose = require("mongoose");

// Auth Token Schema for session management
const AuthTokenSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Auto-delete expired tokens after 25 hours
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 90000 });

// Method to check if token is expired
AuthTokenSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

// Method to check if token is valid
AuthTokenSchema.methods.isValid = function() {
  return this.isActive && !this.isExpired();
};

// Method to refresh token usage
AuthTokenSchema.methods.refreshUsage = function() {
  this.lastUsed = new Date();
  return this.save();
};

const AuthToken = mongoose.model("AuthToken", AuthTokenSchema);

module.exports = AuthToken;

