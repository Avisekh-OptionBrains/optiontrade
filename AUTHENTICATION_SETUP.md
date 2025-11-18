# Authentication System Setup Guide

## Overview

The OptionBrains Trading System now includes a secure email-based OTP authentication system with 24-hour token validity.

## Features

✅ **Email Verification** - Only authorized email can access the system  
✅ **OTP Authentication** - 6-digit OTP sent to email  
✅ **24-Hour Sessions** - Tokens valid for 24 hours  
✅ **Secure Routes** - All dashboard and API routes are protected  
✅ **Auto-Redirect** - Unauthenticated users redirected to login  

## Authorized Email

**Only this email is authorized to access the system:**
```
techsupport@optionbrains.com
```

Any other email will receive an "unauthorized" error message.

## Installation Steps

### 1. Install nodemailer Package

```bash
cd epicrisenew
npm install nodemailer
```

### 2. Configure Email Settings

Edit the `.env` file and update the email configuration:

```env
# Email configuration for OTP Authentication
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=techsupport@optionbrains.com
EMAIL_PASS=your-gmail-app-password
```

#### For Gmail Users:

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** > **2-Step Verification**
3. Scroll down to **App passwords**
4. Generate a new app password for "Mail"
5. Copy the 16-character password
6. Paste it in the `EMAIL_PASS` field in `.env`

**Important:** Use the App Password, NOT your regular Gmail password!

### 3. Start the Server

```bash
npm start
```

## How It Works

### Login Flow

1. **Step 1: Email Verification**
   - User enters email address
   - System checks if email is `techsupport@optionbrains.com`
   - If not authorized: Shows error "You are not authorized to access this system"
   - If authorized: Proceeds to Step 2

2. **Step 2: Request OTP**
   - User clicks "Send OTP" button
   - System generates 6-digit OTP
   - OTP is sent to the email
   - OTP is valid for 10 minutes

3. **Step 3: Verify OTP & Login**
   - User enters the 6-digit OTP from email
   - System verifies the OTP
   - If valid: Generates 24-hour authentication token
   - User is redirected to dashboard

### Session Management

- **Token Validity:** 24 hours from login
- **Storage:** Token stored in localStorage and cookie
- **Auto-Refresh:** Token usage is refreshed on each API call
- **Logout:** Deactivates token immediately

## Protected Routes

### HTML Pages (Require Authentication)
- `/index.html` - Main Dashboard
- `/subscription-manager.html` - Subscription Manager
- `/enhanced-dashboard.html` - Enhanced Dashboard
- `/orders.html` - Orders Page
- All other HTML pages except `login.html`

### API Routes (Require Authentication)
- `/api/*` - All subscription management APIs
- `/api/order-responses/*` - Order response APIs
- `/api/dashboard/*` - Dashboard APIs
- `/api/enhanced-dashboard/*` - Enhanced dashboard APIs
- `/api/users/*` - User management APIs

### Public Routes (No Authentication Required)
- `/login.html` - Login page
- `/api/auth/*` - Authentication APIs
- `/Epicrise/*` - TradingView webhook (for signals)
- `/CMI/*` - TradingView webhook (for signals)
- `/OptionTrade/*` - TradingView webhook (for signals)
- `/BankNifty/*` - TradingView webhook (for signals)

## API Endpoints

### Authentication APIs

#### 1. Verify Email
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "email": "techsupport@optionbrains.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "isAuthorized": true,
  "email": "techsupport@optionbrains.com"
}
```

**Response (Unauthorized):**
```json
{
  "success": false,
  "error": "You are not authorized to access this system",
  "isAuthorized": false
}
```

#### 2. Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "email": "techsupport@optionbrains.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully to your email",
  "expiresIn": 600
}
```

#### 3. Login (Verify OTP)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "techsupport@optionbrains.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "a1b2c3d4e5f6...",
  "expiresIn": 86400,
  "email": "techsupport@optionbrains.com"
}
```

#### 4. Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "email": "techsupport@optionbrains.com",
  "expiresAt": "2025-01-17T10:30:00.000Z"
}
```

#### 5. Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Database Models

### AdminUser Model
- `email` - User email (unique)
- `isAuthorized` - Authorization status
- `lastLogin` - Last login timestamp
- `loginAttempts` - Number of login attempts
- `lastLoginAttempt` - Last attempt timestamp

### OTP Model
- `email` - User email
- `otp` - 6-digit OTP code
- `expiresAt` - Expiration timestamp (10 minutes)
- `verified` - Verification status
- `attempts` - Number of verification attempts (max 3)

### AuthToken Model
- `email` - User email
- `token` - Authentication token (unique)
- `expiresAt` - Expiration timestamp (24 hours)
- `isActive` - Active status
- `lastUsed` - Last usage timestamp

## Security Features

1. **Email Whitelist** - Only `techsupport@optionbrains.com` can access
2. **OTP Expiry** - OTPs expire after 10 minutes
3. **Attempt Limit** - Maximum 3 OTP verification attempts
4. **Token Expiry** - Tokens expire after 24 hours
5. **Auto-Cleanup** - Expired OTPs and tokens are auto-deleted from database
6. **Secure Storage** - Tokens stored in httpOnly cookies and localStorage

## Troubleshooting

### Email Not Sending

1. Check `.env` file has correct email credentials
2. Verify Gmail App Password is correct (not regular password)
3. Check server logs for email errors
4. Ensure 2-Step Verification is enabled on Gmail account

### Login Not Working

1. Check if OTP is still valid (10 minutes)
2. Verify email is exactly `techsupport@optionbrains.com`
3. Check browser console for errors
4. Clear browser cache and cookies

### Token Expired

1. Login again to get a new 24-hour token
2. Tokens automatically expire after 24 hours
3. Check system time is correct

## Files Created

```
epicrisenew/
├── models/
│   ├── AdminUser.js          # Admin user model
│   ├── OTP.js                 # OTP model
│   └── AuthToken.js           # Auth token model
├── routes/
│   └── auth.js                # Authentication routes
├── middleware/
│   └── authMiddleware.js      # Authentication middleware
├── utils/
│   └── emailService.js        # Email service for OTP
├── public/
│   ├── login.html             # Login page UI
│   └── login.js               # Login page JavaScript
└── AUTHENTICATION_SETUP.md    # This file
```

## Next Steps

1. Install nodemailer: `npm install nodemailer`
2. Configure email settings in `.env`
3. Restart the server
4. Access http://localhost:3000/login.html
5. Login with `techsupport@optionbrains.com`

---

**System is now secured with OTP authentication! 🔐**

