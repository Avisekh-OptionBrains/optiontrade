# 🚀 Quick Reference - Token Fix

## Problem
```
❌ Authorization: "Bearer INTEGRATION_PLACEHOLDER_TOKEN"
❌ HTTP Status: 401 Unauthorized
```

## Solution
Fetch real broker token from `BrokerToken` table instead of using placeholder.

---

## Files Changed

### 1. `optiontrade/prisma/schema.prisma`
**Added**: `BrokerAccount` and `BrokerToken` models
**Lines**: 190-253

### 2. `optiontrade/utils/subscriptionManager.js`
**Modified**: `getSubscribedUsers()` function
**Lines**: 44-88 (token fetching logic)
**Lines**: 120-121 (use fetched token)

---

## Key Code Changes

### Before
```javascript
token = user.token; // ❌ Placeholder
```

### After
```javascript
const brokerAccount = await prisma.brokerAccount.findFirst({
  where: { clientId: user.userID, isActive: true }
});

const brokerToken = await prisma.brokerToken.findFirst({
  where: {
    brokerAccountId: brokerAccount.id,
    isActive: true,
    expiresAt: { gt: new Date() }
  }
});

token = brokerToken.accessToken; // ✅ Real token
```

---

## Expected Log Output

```
✅ Using broker token for Avisekh ghosh (expires: 2025-11-21T16:11:24.662Z)
🚀 Sending IIFL order request for Avisekh ghosh...
✅ Order placed for Avisekh ghosh: { success: true }
```

---

## Verification Checklist

- [ ] Real token is used (not placeholder)
- [ ] IIFL API returns 200 OK
- [ ] Orders are placed successfully
- [ ] No 401 Unauthorized errors

---

## Status: ✅ READY

Send a trading signal to test!

