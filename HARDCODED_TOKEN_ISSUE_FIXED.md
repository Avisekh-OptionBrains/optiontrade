# ✅ HARDCODED TOKEN ISSUE - FIXED

## Issue
Orders were failing with **401 Unauthorized** because the system was using:
```
Authorization: "Bearer INTEGRATION_PLACEHOLDER_TOKEN"
```

---

## Root Cause
The `getSubscribedUsers()` function in `optiontrade/utils/subscriptionManager.js` was:
1. Fetching user from `IIFLUser` table
2. Using `user.token` (which was placeholder)
3. **Never checking the `BrokerToken` table** where real tokens are stored

---

## Solution

### Change 1: Added Prisma Models
**File**: `optiontrade/prisma/schema.prisma` (Lines 190-253)

Added two models to access existing database tables:
- `BrokerAccount` - Broker connection info
- `BrokerToken` - Actual IIFL access tokens

### Change 2: Updated Token Fetching
**File**: `optiontrade/utils/subscriptionManager.js` (Lines 44-88)

Modified `getSubscribedUsers()` to:
1. Find broker account for user
2. Query `BrokerToken` table for active token
3. Use real token instead of placeholder
4. Fallback to placeholder if no token found

---

## Code Changes

### Before (❌ Broken)
```javascript
const user = await prisma.iIFLUser.findFirst(...);
token = user.token; // ❌ "INTEGRATION_PLACEHOLDER_TOKEN"
```

### After (✅ Fixed)
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

## Expected Results

### Before
```
❌ Authorization: Bearer INTEGRATION_PLACEHOLDER_TOKEN
❌ HTTP 401 Unauthorized
❌ Error: Request failed with status code 401
```

### After
```
✅ Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
✅ HTTP 200 OK
✅ Order placed successfully
```

---

## Files Modified
1. ✅ `optiontrade/prisma/schema.prisma`
2. ✅ `optiontrade/utils/subscriptionManager.js`

---

## Status: ✅ COMPLETE

Ready for testing with real trading signals!

