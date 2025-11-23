const mongoose = require("mongoose");

// OTP Schema for email verification
const OTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    otp: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    },
    verified: {
      type: Boolean,
      default: false
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Auto-delete expired OTPs after 15 minutes
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 900 });

// Method to check if OTP is expired
OTPSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

// Method to verify OTP
OTPSchema.methods.verify = function(inputOtp) {
  if (this.isExpired()) {
    return { success: false, error: 'OTP has expired' };
  }
  
  if (this.attempts >= 3) {
    return { success: false, error: 'Maximum verification attempts exceeded' };
  }
  
  this.attempts += 1;
  
  if (this.otp === inputOtp) {
    this.verified = true;
    return { success: true };
  }
  
  return { success: false, error: 'Invalid OTP' };
};

const OTP = mongoose.model("OTP", OTPSchema);

module.exports = OTP;

