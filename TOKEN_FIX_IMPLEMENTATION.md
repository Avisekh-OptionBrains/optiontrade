# 🎯 Token Fix Implementation - Complete

## Problem Statement
Orders were failing with **401 Unauthorized** error because the system was sending a hardcoded placeholder token instead of the actual broker token.

**Error Response:**
```
Authorization: "Bearer INTEGRATION_PLACEHOLDER_TOKEN"
HTTP Status: 401
Error: Request failed with status code 401
```

---

## Solution Overview

The fix involves two main changes:

### 1. **Add Broker Token Models to Prisma Schema**
- Reference existing `BrokerAccount` and `BrokerToken` tables
- Enable Prisma to query these tables from optiontrade project

### 2. **Update Subscription Manager**
- Fetch real broker token from database
- Use token for IIFL API calls
- Fallback to placeholder if no token found

---

## Implementation Details

### Step 1: Update Prisma Schema
**File**: `optiontrade/prisma/schema.prisma`

Added models to reference existing database tables:

```prisma
model BrokerAccount {
  id              String    @id @default(uuid())
  userId          String
  brokerType      String
  clientId        String    // IIFL userID
  clientName      String
  isActive        Boolean   @default(true)
  isConnected     Boolean   @default(false)
  lastConnected   DateTime?
  allocatedCapital Decimal? @db.Decimal(15, 2)
  brokerMetadata  Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  brokerTokens    BrokerToken[]
  @@unique([userId, brokerType, clientId])
  @@map("broker_accounts")
}

model BrokerToken {
  id              String    @id @default(uuid())
  userId          String
  brokerAccountId String
  strategyId      String
  subscriptionId  String?
  accessToken     String    @db.Text
  refreshToken    String?   @db.Text
  tokenType       String
  expiresAt       DateTime
  allocatedCapital Decimal  @db.Decimal(15, 2)
  isActive        Boolean   @default(true)
  lastUsed        DateTime?
  usageCount      Int       @default(0)
  brokerMetadata  Json?
  brokerAccount   BrokerAccount @relation(fields: [brokerAccountId], references: [id], onDelete: Cascade)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@unique([userId, brokerAccountId, strategyId])
  @@map("broker_tokens")
}
```

### Step 2: Update Subscription Manager
**File**: `optiontrade/utils/subscriptionManager.js`

Modified `getSubscribedUsers()` function:

```javascript
// Try to fetch actual broker token from BrokerToken table
if (user.password === "INTEGRATION_MANAGED" || !token) {
  try {
    // Find broker account for this user
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: { clientId: user.userID, isActive: true }
    });

    if (brokerAccount) {
      // Find active broker token for this account
      const brokerToken = await prisma.brokerToken.findFirst({
        where: {
          brokerAccountId: brokerAccount.id,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (brokerToken) {
        token = brokerToken.accessToken;  // ✅ Real token
        tokenValidity = brokerToken.expiresAt;
        console.log(`✅ Using broker token for ${user.clientName}`);
      }
    }
  } catch (tokenError) {
    console.error(`❌ Error fetching broker token:`, tokenError.message);
    token = "INTEGRATION_PLACEHOLDER_TOKEN";
  }
}
```

---

## Expected Results

### Before Fix
```
❌ Authorization: Bearer INTEGRATION_PLACEHOLDER_TOKEN
❌ HTTP Status: 401 Unauthorized
❌ Error: Request failed with status code 401
```

### After Fix
```
✅ Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
✅ HTTP Status: 200 OK
✅ Order placed successfully
```

---

## Files Changed

1. ✅ `optiontrade/prisma/schema.prisma` - Added models
2. ✅ `optiontrade/utils/subscriptionManager.js` - Updated token fetching

---

## Status: ✅ COMPLETE

Ready for testing with real trading signals!

