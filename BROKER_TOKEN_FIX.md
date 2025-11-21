# ✅ Broker Token Fix - COMPLETE

## Problem
The system was using hardcoded `INTEGRATION_PLACEHOLDER_TOKEN` instead of fetching the actual broker token from the database.

**Error Log:**
```
Authorization: "Bearer INTEGRATION_PLACEHOLDER_TOKEN"
HTTP Status: 401 Unauthorized
```

---

## Root Cause

In `optiontrade/utils/subscriptionManager.js`, the `getSubscribedUsers()` function was:
1. Fetching user from `IIFLUser` table
2. Using `user.token` which was the placeholder token
3. Never checking the `BrokerToken` table (which exists in the same PostgreSQL database)

---

## Solution

Updated `getSubscribedUsers()` to:

### 1. **Check for Broker Account**
```javascript
const brokerAccount = await prisma.brokerAccount.findFirst({
  where: { 
    clientId: user.userID,
    isActive: true 
  }
});
```

### 2. **Fetch Active Broker Token**
```javascript
const brokerToken = await prisma.brokerToken.findFirst({
  where: {
    brokerAccountId: brokerAccount.id,
    isActive: true,
    expiresAt: { gt: new Date() } // Not expired
  },
  orderBy: { createdAt: 'desc' }
});
```

### 3. **Use Real Token**
```javascript
if (brokerToken) {
  token = brokerToken.accessToken;  // ✅ Real token
  tokenValidity = brokerToken.expiresAt;
}
```

### 4. **Fallback to Placeholder**
If no broker token found, use placeholder for testing

---

## Files Modified

### 1. **`optiontrade/utils/subscriptionManager.js`**
- Lines 44-88: Added broker token fetching logic
- Lines 120-121: Updated to use fetched token

### 2. **`optiontrade/prisma/schema.prisma`**
- Added `BrokerAccount` model (lines 190-207)
- Added `BrokerToken` model (lines 209-253)
- These models reference the existing tables in the PostgreSQL database

---

## Token Flow

```
Trading Signal Arrives
    ↓
getSubscribedUsers() called
    ↓
Find IIFLUser
    ↓
Check BrokerAccount (NEW)
    ↓
Fetch BrokerToken from DB (NEW)
    ↓
Use Real Token for IIFL API
    ↓
✅ Order Placed Successfully
```

---

## Testing

To verify the fix:

1. Send a trading signal
2. Check logs for: `✅ Using broker token for [ClientName]`
3. Verify IIFL API receives real token (not placeholder)
4. Check order status: Should be SUCCESS (not 401 Unauthorized)

---

## Status: ✅ READY

All changes implemented and ready for testing!

**Next Step**: Run trading signal and verify token is used correctly.

