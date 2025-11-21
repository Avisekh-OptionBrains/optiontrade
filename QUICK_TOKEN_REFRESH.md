# ⚡ Quick Token Refresh Reference

## 🚀 Quick Commands

### ✅ Refresh All Tokens (PostgreSQL - Prisma)
```bash
node scripts/refresh-tokens-prisma.js
```

### ✅ Refresh Specific User (PostgreSQL)
```bash
node scripts/refresh-tokens-prisma.js --user 28748327
```

### ✅ Verbose Output (PostgreSQL)
```bash
node scripts/refresh-tokens-prisma.js --verbose
```

**Note**: optiontrade uses **PostgreSQL** for IIFLUser storage, not MongoDB!

### Via API - Refresh All
```bash
curl -X POST http://localhost:3001/api/integration/tokens/refresh-all \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Via API - Refresh One User
```bash
curl -X POST http://localhost:3001/api/integration/tokens/refresh/28748327 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 📊 What Gets Refreshed

✅ **Real IIFL Users**
- userID: 28748327
- password: real_password
- appKey: real_key
- appSecret: real_secret
- totpSecret: real_totp

❌ **Integration-Managed Users** (Skipped)
- password: INTEGRATION_MANAGED
- Used for testing only
- No real credentials

---

## 🔄 Automatic Refresh

**When**: Every day at 3:00 AM
**Where**: `optiontrade/server.js` (Lines 372-376)
**Enable**: Set `ENABLE_LOCAL_IIFL_LOGIN=true` in `.env`

---

## 📈 Token Validity

- **Duration**: 12 hours
- **Valid From**: 3:00 AM
- **Valid Until**: 3:00 PM
- **Refresh**: Next day at 3:00 AM

---

## ✅ Success Response

```json
{
  "success": true,
  "message": "Token refresh completed",
  "refreshed": 2,
  "failed": 0,
  "total": 2
}
```

---

## ❌ Error Response

```json
{
  "success": false,
  "error": "Invalid credentials for user 28748327"
}
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key in Authorization header |
| User not found | Verify userID exists in database |
| Rate limit | Wait 2 seconds between requests |
| No users | Create users first via `/api/integration/broker/register` |

---

## 📝 Files

- **Scripts**: `optiontrade/scripts/refresh-tokens-prisma.js`
- **API**: `optiontrade/routes/integration.js` (Lines 393-532)
- **Cron**: `optiontrade/server.js` (Lines 372-376)

---

## 🎯 Status: ✅ READY

All token refresh methods working and tested!

