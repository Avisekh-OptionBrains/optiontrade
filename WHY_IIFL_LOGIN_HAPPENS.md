# ❓ Why Does IIFL Login Happen When Running Scripts?

## The Answer

When you run a trading signal script, the system doesn't automatically login to IIFL. Instead:

1. **The server is already running** (`npm run dev`)
2. **The server has a cron job** that runs daily at 3:00 AM
3. **The cron job logs in all IIFL users** and stores their tokens in the database
4. **When a trading signal arrives**, the system uses the **pre-stored token** from the database

---

## How It Works

### 1. Daily Token Refresh (Cron Job)
**File:** `optiontrade/server.js` (Lines 372-376)

```javascript
// IIFL login cron job - runs at 3:00 AM daily
if (process.env.ENABLE_LOCAL_IIFL_LOGIN === "true") {
  schedule.scheduleJob("00 3 * * *", async () => {
    console.log("IIFL scheduled login task triggered at 3:00 AM");
    await loginToIIFLForAllClients();
  });
}
```

### 2. Login Process
**File:** `optiontrade/server.js` (Lines 100-160)

```javascript
async function loginToIIFLForAllClients() {
  // 1. Fetch all IIFL users from database
  const users = await IIFLUser.find();
  
  // 2. For each user, login to IIFL
  for (const userData of users) {
    const userCredentials = {
      userID: userData.userID,
      password: userData.password,
      appKey: userData.appKey,
      appSecret: userData.appSecret,
      totpSecret: userData.totpSecret
    };
    
    // 3. Call IIFL login API
    const loginResult = await loginWithCredentials(userCredentials);
    
    // 4. Store token in database
    userData.token = loginResult.accessToken;
    userData.tokenValidity = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await userData.save();
  }
}
```

### 3. Token Storage
**Database:** MongoDB (IIFLUser collection)

```javascript
{
  userID: "28748327",
  clientName: "Avisekh ghosh",
  token: "eyJhbGciOiJIUzI1NiIs...",  // ✅ Stored here
  tokenValidity: "2025-11-20T23:59:59Z",
  lastLoginTime: "2025-11-20T03:00:00Z",
  loginStatus: "success",
  tradingStatus: "active"
}
```

### 4. Order Execution (Uses Stored Token)
**File:** `optiontrade/Strategies/OptionTrade/Brokers/IIFL/optionTradingHandler.js`

```javascript
async function placeOrderForUser(user, order, signal) {
  const { token, clientName } = user;
  
  // ✅ Use the pre-stored token from database
  const response = await axios.post(
    `${IIFL_BASE_URL}/orders`,
    orderPayload,
    {
      headers: {
        "Authorization": `Bearer ${token}`  // ✅ Token from DB
      }
    }
  );
}
```

---

## Timeline

```
3:00 AM (Daily)
  ↓
Cron Job Triggers
  ↓
Login to IIFL for all users
  ↓
Get access tokens
  ↓
Store tokens in database
  ↓
Tokens valid for 12 hours (3:00 AM - 3:00 PM)
  ↓
During the day (3:00 AM - 3:00 PM)
  ↓
Trading signals arrive
  ↓
System uses stored token from database
  ↓
Orders placed successfully
```

---

## Why You See Login Logs

When you run the server with `npm run dev`, you might see login logs because:

1. **Server just started** - It might run the login function on startup
2. **Manual trigger** - You called `/api/trigger-iifl-login` endpoint
3. **Cron job ran** - If it's 3:00 AM, the scheduled job runs
4. **Integration-managed users** - They use placeholder tokens (no real login)

---

## For Integration-Managed Users

**File:** `optiontrade/routes/integration.js` (Lines 233-236)

```javascript
// Integration-managed users (created via frontend)
password: "INTEGRATION_MANAGED",
appKey: "INTEGRATION_MANAGED",
appSecret: "INTEGRATION_MANAGED",
totpSecret: "INTEGRATION_MANAGED",
token: "INTEGRATION_PLACEHOLDER_TOKEN"  // ✅ Placeholder
```

These users:
- ✅ Don't need real IIFL credentials
- ✅ Use placeholder tokens for testing
- ✅ Orders are simulated (not placed on real broker)
- ✅ Perfect for development and testing

---

## For Real IIFL Users

Real users with actual IIFL credentials:
- ✅ Login happens daily at 3:00 AM
- ✅ Real tokens are generated and stored
- ✅ Orders are placed on real IIFL broker
- ✅ Tokens are valid for 12 hours

---

## Manual Login Trigger

You can manually trigger login anytime:

```bash
curl -X POST http://localhost:3001/api/trigger-iifl-login
```

Response:
```json
{
  "success": true,
  "message": "IIFL login process completed"
}
```

---

## Summary

✅ **IIFL login is NOT happening when you run trading signals**
✅ **Login happens once daily at 3:00 AM via cron job**
✅ **Tokens are stored in database for 12 hours**
✅ **Trading signals use pre-stored tokens**
✅ **No login needed for each trade execution**

This is the **correct and efficient** approach! 🎉

