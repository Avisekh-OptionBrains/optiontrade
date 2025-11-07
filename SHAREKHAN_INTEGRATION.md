# ShareKhan Broker Integration Documentation

## 🎯 **Overview**

This document describes the complete ShareKhan broker integration with automatic login, token management, and trading capabilities.

## 🔧 **Architecture**

### **Authentication Flow**
1. **User Registration**: Users provide login credentials (userId, password, apiKey)
2. **Scheduled Login**: Cron job runs daily at 3:35 AM to generate access tokens
3. **Token Storage**: Access tokens are stored in MongoDB with validity tracking
4. **Trading**: Orders use stored access tokens for authentication

### **Key Components**
- **Model**: `models/ShareKhanUser.js` - MongoDB schema
- **Login Logic**: `server.js` - `loginToShareKhanForAllClients()` function
- **Trading Logic**: `Strategies/Epicrise/Brokers/ShareKhan/ShareKhanUtils.js`
- **API Routes**: `Strategies/Epicrise/Brokers/ShareKhan/ShareKhan.js`
- **Frontend**: `public/user-management.html` and `public/user-management.js`

## 📊 **Database Schema**

```javascript
{
  email: String,              // User's email
  phoneNumber: String,        // Contact number
  clientName: String,         // Display name
  userId: String,             // ShareKhan User ID (no password needed)
  apiKey: String,             // ShareKhan API key
  vendorKey: String,          // ShareKhan Vendor key (optional)
  accessToken: String,        // Generated access token (auto-updated)
  requestToken: String,       // Generated request token (auto-updated)
  capital: Number,            // Trading capital
  state: String,              // Account state (default: "live")
  tokenValidity: Date,        // Token expiration date
  lastLoginTime: Date,        // Last successful login
  loginStatus: String,        // "pending", "success", "failed"
  tradingStatus: String,      // "active", "inactive"
  timestamps: true            // createdAt, updatedAt
}
```

## 🔐 **Authentication Process**

### **Daily Login Cron Job**
- **Schedule**: Every day at 3:35 AM
- **Process**:
  1. Fetch all ShareKhan users from database
  2. For each user:
     - Send login request to ShareKhan API
     - Generate request token
     - Use request token to generate access token
     - Store tokens in database with validity
     - Update login status

### **Login API Endpoints**
```javascript
// Step 1: Login and get request token
POST https://api.sharekhan.com/skapi/auth/login
{
  "userid": "USER123",
  "password": "password",
  "vendorkey": "api_key"
}

// Step 2: Generate access token
POST https://api.sharekhan.com/skapi/auth/accessToken
{
  "requestToken": "request_token_from_step1",
  "apiKey": "api_key"
}
```

## 📈 **Trading Integration**

### **Order Placement**
- Uses stored access token for authentication
- Validates token expiry before placing orders
- Supports both regular and stop-loss orders
- Automatic quantity calculation based on capital

### **API Endpoint**
```javascript
POST https://api.sharekhan.com/skapi/orders/regular
Headers: {
  "access-token": "stored_access_token",
  "api-key": "user_api_key"
}
```

## 🚀 **Setup Instructions**

### **1. User Registration**
Navigate to `/user-management.html` and:
1. Select "ShareKhan" as broker
2. Fill in required fields:
   - Email
   - Phone Number
   - Client Name
   - ShareKhan User ID
   - ShareKhan API Key
   - Vendor Key (optional)
   - Capital amount

### **2. Token Generation**
- **Automatic**: Cron job runs daily at 3:35 AM
- **Manual**: Call `POST /api/trigger-sharekhan-login` for testing

### **3. Trading**
Once tokens are generated, ShareKhan users will automatically receive trading signals.

## 🧪 **Testing**

### **Test Script**
Run the comprehensive test suite:
```bash
node test-sharekhan.js
```

### **Test Coverage**
- ✅ User creation with login credentials
- ✅ User retrieval and statistics
- ✅ Manual login trigger
- ✅ Trading API endpoint
- ✅ Token validation

### **Manual Testing**
1. **Add User**: Use user management interface
2. **Trigger Login**: `POST /api/trigger-sharekhan-login`
3. **Check Status**: Verify `loginStatus` and `accessToken` in database
4. **Send Signal**: Test trading with actual signal

## 📋 **API Endpoints**

### **User Management**
- `POST /addShareKhanuser` - Register new ShareKhan user
- `GET /api/users/sharekhan` - Get all ShareKhan users
- `GET /api/users/stats/summary` - Get user statistics

### **Authentication**
- `POST /api/trigger-sharekhan-login` - Manual login trigger

### **Trading**
- `POST /Epicrise/ShareKhan` - Process trading signals

## 🔍 **Monitoring & Logs**

### **Login Process Logs**
```
🔐 Starting ShareKhan login process for all clients...
📊 Found 3 ShareKhan users to process
🔄 Processing ShareKhan login for: John Doe (USER123)
📡 Sending login request for USER123...
✅ Login response for USER123: { success: true, ... }
🔑 Generating access token for USER123...
✅ Access token response for USER123: { success: true, ... }
✅ Tokens stored successfully for USER123
📅 Token validity: 2024-08-25T15:30:00.000Z
🔑 Access token: abcd1234efgh5678...
🎉 ShareKhan login process completed for all clients
```

### **Trading Logs**
```
📊 Client Details:
   👤 Name: John Doe
   💰 Capital: ₹50,000
   🔑 Has Access Token: true
   🔑 Access Token Length: 64 chars
   🔑 Has API Key: true
✅ ShareKhan order placed successfully
```

## ⚠️ **Error Handling**

### **Common Issues**
1. **Invalid Credentials**: Check userId, password, apiKey
2. **Expired Token**: Wait for next cron job or trigger manual login
3. **API Rate Limits**: Built-in 2-second delay between requests
4. **Network Issues**: Automatic retry logic with error logging

### **Status Monitoring**
- `loginStatus`: "pending" → "success" / "failed"
- `tradingStatus`: "inactive" → "active"
- `tokenValidity`: Check expiration date

## 🔄 **Maintenance**

### **Token Refresh**
- **Automatic**: Daily at 3:35 AM
- **Manual**: Use trigger endpoint for immediate refresh
- **Monitoring**: Check `lastLoginTime` and `tokenValidity`

### **Database Cleanup**
- Old tokens are automatically overwritten
- Failed login attempts are logged with timestamps
- User status is updated in real-time

## 📞 **Support**

For issues or questions:
1. Check logs for error details
2. Verify ShareKhan API credentials
3. Test with manual login trigger
4. Review token validity and status fields

---

**Integration Status**: ✅ **COMPLETE**
**Last Updated**: August 2024
**Version**: 1.0.0
