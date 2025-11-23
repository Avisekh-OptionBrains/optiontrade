const mongoose = require("mongoose");

// Admin User Schema for authentication
const AdminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: props => `${props.value} is not a valid email!`
      }
    },
    isAuthorized: {
      type: Boolean,
      default: false
    },
    lastLogin: {
      type: Date
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lastLoginAttempt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Check if email is authorized
AdminUserSchema.methods.isEmailAuthorized = function() {
  return this.email === 'techsupport@optionbrains.com';
};

const AdminUser = mongoose.model("AdminUser", AdminUserSchema);

module.exports = AdminUser;

