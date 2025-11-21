const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const AdminUser = require('../models/AdminUser');
const OTP = require('../models/OTP');
const AuthToken = require('../models/AuthToken');
const { generateOTP, sendOTPEmail } = require('../utils/emailService');

// Authorized email
const AUTHORIZED_EMAIL = 'techsupport@optionbrains.com';

// Step 1: Verify email address
router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`🔍 Email verification attempt: ${normalizedEmail}`);

    // Check if email is authorized
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      console.log(`❌ Unauthorized email attempt: ${normalizedEmail}`);
      
      // Log unauthorized attempt
      let user = await AdminUser.findOne({ email: normalizedEmail });
      if (!user) {
        user = new AdminUser({ email: normalizedEmail, isAuthorized: false });
      }
      user.loginAttempts += 1;
      user.lastLoginAttempt = new Date();
      await user.save();

      return res.status(403).json({ 
        success: false, 
        error: 'You are not authorized to access this system',
        isAuthorized: false
      });
    }

    // Email is authorized
    console.log(`✅ Authorized email verified: ${normalizedEmail}`);

    // Find or create admin user
    let user = await AdminUser.findOne({ email: normalizedEmail });
    if (!user) {
      user = new AdminUser({ 
        email: normalizedEmail, 
        isAuthorized: true 
      });
      await user.save();
      console.log(`✅ Created new admin user: ${normalizedEmail}`);
    }

    res.json({ 
      success: true, 
      message: 'Email verified successfully',
      isAuthorized: true,
      email: normalizedEmail
    });
  } catch (error) {
    console.error('❌ Error verifying email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify email' 
    });
  }
});

// Step 2: Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify email is authorized
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not authorized to access this system' 
      });
    }

    console.log(`📧 Sending OTP to: ${normalizedEmail}`);

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email: normalizedEmail });

    // Generate new OTP
    const otp = generateOTP();
    console.log(`🔑 Generated OTP: ${otp}`);

    // Save OTP to database
    const otpDoc = new OTP({
      email: normalizedEmail,
      otp: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    await otpDoc.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(normalizedEmail, otp);

    if (!emailResult.success) {
      console.error(`❌ Failed to send OTP email: ${emailResult.error}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send OTP email. Please try again.' 
      });
    }

    console.log(`✅ OTP sent successfully to: ${normalizedEmail}`);

    res.json({ 
      success: true, 
      message: 'OTP sent successfully to your email',
      expiresIn: 600 // 10 minutes in seconds
    });
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP' 
    });
  }
});

// Step 3: Verify OTP and login
router.post('/login', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and OTP are required' 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log(`🔐 Login attempt for: ${normalizedEmail}`);

    // Find the OTP
    const otpDoc = await OTP.findOne({ 
      email: normalizedEmail,
      verified: false
    });

    if (!otpDoc) {
      console.log(`❌ No OTP found for: ${normalizedEmail}`);
      return res.status(400).json({ 
        success: false, 
        error: 'No OTP found. Please request a new OTP.' 
      });
    }

    // Verify OTP
    const verificationResult = otpDoc.verify(otp);
    await otpDoc.save();

    if (!verificationResult.success) {
      console.log(`❌ OTP verification failed: ${verificationResult.error}`);
      return res.status(400).json({ 
        success: false, 
        error: verificationResult.error 
      });
    }

    console.log(`✅ OTP verified successfully for: ${normalizedEmail}`);

    // Generate auth token (24-hour validity)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Deactivate any existing tokens for this email
    await AuthToken.updateMany(
      { email: normalizedEmail, isActive: true },
      { isActive: false }
    );

    // Create new auth token
    const authToken = new AuthToken({
      email: normalizedEmail,
      token: token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    await authToken.save();

    // Update user last login
    await AdminUser.findOneAndUpdate(
      { email: normalizedEmail },
      { lastLogin: new Date(), loginAttempts: 0 }
    );

    console.log(`✅ Login successful for: ${normalizedEmail}`);
    console.log(`🔑 Token generated, valid for 24 hours`);

    res.cookie('authToken', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ 
      success: true, 
      message: 'Login successful',
      token: token,
      expiresIn: 86400,
      email: normalizedEmail
    });
  } catch (error) {
    console.error('❌ Error during login:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed' 
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Find token in database
    const authToken = await AuthToken.findOne({ token: token });

    if (!authToken || !authToken.isValid()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Refresh token usage
    await authToken.refreshUsage();

    res.json({
      success: true,
      email: authToken.email,
      expiresAt: authToken.expiresAt
    });
  } catch (error) {
    console.error('❌ Error verifying token:', error);
    res.status(500).json({
      success: false,
      error: 'Token verification failed'
    });
  }
});

module.exports = router;

