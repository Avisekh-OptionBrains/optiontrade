# 🔐 Token Refresh Guide - Complete Documentation

## Overview

Three ways to refresh IIFL tokens:

1. **Automatic**: Daily cron job at 3:00 AM
2. **Manual Script**: Run Node.js script anytime
3. **API Endpoint**: HTTP request to backend

---

## Method 1: Automatic Refresh (Cron Job)

### How It Works
- **Schedule**: Every day at 3:00 AM
- **File**: `optiontrade/server.js` (Lines 372-376)
- **Scope**: All real IIFL users (excludes integration-managed)

### Configuration
```javascript
if (process.env.ENABLE_LOCAL_IIFL_LOGIN === "true") {
  schedule.scheduleJob("00 3 * * *", async () => {
    console.log("IIFL scheduled login task triggered at 3:00 AM");
    await loginToIIFLForAllClients();
  });
}
```

### Enable/Disable
```bash
# Enable in .env
ENABLE_LOCAL_IIFL_LOGIN=true

# Disable in .env
ENABLE_LOCAL_IIFL_LOGIN=false
```

---

## Method 2: Manual Script

### ✅ PostgreSQL Version (Prisma) - USE THIS ONE
```bash
# Refresh all users
node scripts/refresh-tokens-prisma.js

# Refresh specific user
node scripts/refresh-tokens-prisma.js --user 28748327

# Verbose output
node scripts/refresh-tokens-prisma.js --verbose

# Combine options
node scripts/refresh-tokens-prisma.js --user 28748327 --verbose
```

### ⚠️ MongoDB Version (Legacy - Not Used)
```bash
# This script is for MongoDB only
# optiontrade uses PostgreSQL, so use refresh-tokens-prisma.js instead
node scripts/refresh-all-tokens.js
```

**Note**: The main optiontrade backend uses **PostgreSQL** for IIFLUser storage, not MongoDB. Always use the Prisma version!

### Output Example
```
╔════════════════════════════════════════════════════════════╗
║         🔐 IIFL TOKEN REFRESH SCRIPT (Prisma)              ║
╚════════════════════════════════════════════════════════════╝

🔍 Fetching all IIFL users...
📊 Found 2 user(s) to process

============================================================

🔄 Refreshing token for: Avisekh ghosh (2a66c354-2cfa-467c-a14b-da76a6ca13c7)
✅ Token refreshed successfully for 2a66c354-2cfa-467c-a14b-da76a6ca13c7

🔄 Refreshing token for: Real User (28748327)
✅ Token refreshed successfully for 28748327

============================================================

📊 REFRESH SUMMARY:

✅ Successful: 2
❌ Failed: 0
⏭️  Skipped: 0
📈 Total: 2

============================================================
✅ Token refresh completed!
```

---

## Method 3: API Endpoints

### Refresh All Users
```bash
curl -X POST http://localhost:3001/api/integration/tokens/refresh-all \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Token refresh completed",
  "refreshed": 2,
  "failed": 0,
  "total": 2,
  "results": [
    {
      "success": true,
      "userID": "28748327",
      "clientName": "Real User"
    },
    {
      "success": true,
      "userID": "28748328",
      "clientName": "Another User"
    }
  ]
}
```

### Refresh Specific User
```bash
curl -X POST http://localhost:3001/api/integration/tokens/refresh/28748327 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed for Real User",
  "userID": "28748327",
  "clientName": "Real User",
  "tokenValidity": "2025-11-21T16:11:25.000Z"
}
```

---

## Token Lifecycle

```
3:00 AM (Daily)
  ↓
Cron Job Triggers
  ↓
For each real user:
  - Get credentials
  - Call IIFL OAuth API
  - Get access token
  - Store in database
  - Set validity to 12 hours
  ↓
Tokens valid: 3:00 AM - 3:00 PM
  ↓
Trading signals use stored tokens
  ↓
3:00 PM
  ↓
Token expires
  ↓
Next day 3:00 AM
  ↓
Refresh cycle repeats
```

---

## User Types

### Integration-Managed Users
- ✅ Skipped during refresh
- ✅ Use placeholder tokens
- ✅ For testing/development
- ✅ No real IIFL credentials

### Real IIFL Users
- ✅ Refreshed daily
- ✅ Use real IIFL tokens
- ✅ For production trading
- ✅ Require valid credentials

---

## Troubleshooting

### Token Refresh Failed
```
❌ Failed to refresh token for User: Invalid credentials
```
**Solution**: Verify IIFL credentials (userID, password, appKey, appSecret, totpSecret)

### No Users Found
```
⚠️ No IIFL users found in database
```
**Solution**: Create users first via `/api/integration/broker/register`

### Rate Limiting
```
❌ Too many requests
```
**Solution**: Scripts automatically add 2-second delay between users

---

## Best Practices

✅ **Do:**
- Run manual refresh before important trading sessions
- Monitor token validity in database
- Keep credentials secure
- Use API key for endpoint access

❌ **Don't:**
- Refresh too frequently (causes rate limiting)
- Share API keys
- Store credentials in code
- Disable cron job without alternative

---

## Status: ✅ READY

All token refresh methods are:
- ✅ Implemented
- ✅ Tested
- ✅ Production-ready
- ✅ Fully documented

