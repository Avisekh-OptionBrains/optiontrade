const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter for sending emails
const createTransporter = () => {
  // Check if email credentials are configured
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = process.env.EMAIL_PORT || 587;

  if (!emailUser || !emailPass) {
    console.warn('⚠️ Email credentials not configured in .env file');
    return null;
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort == 465, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.error('❌ Email transporter not configured');
      return {
        success: false,
        error: 'Email service not configured. Please contact administrator.'
      };
    }

    const mailOptions = {
      from: `"OptionBrains Trading System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your OTP for OptionBrains Login',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 OptionBrains Trading System</h1>
              <p>Secure Login Verification</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>You have requested to login to the OptionBrains Trading System.</p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Your One-Time Password (OTP)</p>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 5px 0;">
                  <li>This OTP is valid for <strong>10 minutes</strong></li>
                  <li>Do not share this OTP with anyone</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>
              
              <p>Enter this OTP in the login page to access the system.</p>
              
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} OptionBrains Trading System. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    console.log(`📧 Sending OTP email to: ${email}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent successfully. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send OTP email'
    };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail
};

