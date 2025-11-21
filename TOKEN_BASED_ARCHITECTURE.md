# Token-Based Execution Architecture

## Overview

All 3 strategies in optiontrade now use a **unified token-based execution system** via the `subscriptionManager`. This ensures consistent behavior across Epic Rise, Bank Nifty, and Option Trade strategies.

## Architecture Flow

```
Trading Signal Arrives
    ↓
Strategy Router (/Epicrise, /BankNifty, /OptionTrade)
    ↓
Broker Handler (IIFL.js)
    ↓
subscriptionManager.getSubscribedUsers(strategy, symbol)
    ↓
Returns: Users with merged subscription config + credentials
    ↓
Execute Orders for Each User
    ↓
Check if Integration-Managed or Real User
    ↓
Simulate or Place Real Order
```

## Key Components

### 1. Subscription Manager (`utils/subscriptionManager.js`)

**Purpose:** Central service to fetch users subscribed to a strategy with their config

**Function:**
```javascript
getSubscribedUsers(strategy, symbol)
```

**Parameters:**
- `strategy`: 'Epicrise', 'OptionTrade', or 'BankNifty'
- `symbol`: Trading symbol (optional, for quantity calculation)

**Returns:**
```javascript
[
  {
    // User credentials (from IIFLUser table)
    userID: "28748327",
    clientName: "John Doe",
    email: "john@example.com",
    token: "eyJhbGc...", // or "INTEGRATION_PLACEHOLDER_TOKEN"
    tokenValidity: "2025-11-21T00:00:00.000Z",
    state: "live",
    
    // Strategy-specific config (from subscription table)
    subscription: {
      capital: 50000,        // For Epicrise
      lotSize: 2,            // For BankNifty/OptionTrade
      quantity: 70,          // Calculated (lotSize × lot size)
      maxPositions: 3,
      riskPerTrade: 2,
      customSettings: {...}
    }
  }
]
```

### 2. User Types

#### A. Real Users (with broker credentials)
- Have actual IIFL credentials (userID, password, appKey, appSecret, totpSecret)
- Have valid session token from IIFL login
- Orders are placed via IIFL API
- Token refreshed daily at 3:00 AM via cron job

#### B. Integration-Managed Users
- Created via frontend integration API
- Have `password === "INTEGRATION_MANAGED"`
- No real broker credentials
- Get placeholder token: `"INTEGRATION_PLACEHOLDER_TOKEN"`
- Orders are **simulated** (not sent to broker)
- Used for testing and demo purposes

### 3. Strategy-Specific Subscriptions

Each strategy has its own subscription table in PostgreSQL:

| Strategy | Table | Key Fields |
|----------|-------|------------|
| Epic Rise | `epicriseSubscription` | `capital` (₹) |
| Bank Nifty | `bankNiftySubscription` | `lotSize`, `quantity` |
| Option Trade | `optionTradeSubscription` | `lotSize`, `quantity` |

**Common Fields:**
- `userID` - Links to IIFLUser
- `enabled` - Boolean (active/inactive)
- `maxPositions` - Max concurrent positions
- `riskPerTrade` - Risk percentage per trade
- `customSettings` - JSON for broker-specific config

## Implementation Per Strategy

### Epic Rise

**File:** `Strategies/Epicrise/Brokers/IIFL/IIFLUtils.js`

```javascript
async function placeOrdersForSubscribedEpicriseUsers(symbol, action, price, stopLoss) {
  const { getSubscribedUsers } = require("../../../../utils/subscriptionManager");
  const users = await getSubscribedUsers('Epicrise', symbol);
  
  for (const user of users) {
    const userWithCapital = {
      ...user,
      capital: user.subscription?.capital || 0
    };
    
    const result = await placeOrderForUser(userWithCapital, symbol, action, price, stopLoss);
    results.push(result);
  }
}
```

**Capital-Based:** Uses `subscription.capital` to calculate quantity

### Bank Nifty

**File:** `Strategies/BankNifty/Brokers/IIFL/bankNiftyTradingHandler.js`

```javascript
async function processBBTrapSignal(messageText) {
  const users = await getSubscribedUsers('BankNifty', signal.symbol);
  
  for (const user of users) {
    // user.subscription.lotSize = number of lots
    // user.subscription.quantity = calculated quantity (lots × 35 for BankNifty)
    const result = await placeOrderForUser(user, order);
    results.push(result);
  }
}
```

**Lot-Based:** Uses `subscription.lotSize` and `subscription.quantity`

### Option Trade

**File:** `Strategies/OptionTrade/Brokers/IIFL/optionTradingHandler.js`

```javascript
async function processBBTrapSignal(signalText) {
  const users = await getSubscribedUsers('OptionTrade', signal.symbol);
  
  for (const user of users) {
    // user.subscription.lotSize = number of lots
    // user.subscription.quantity = calculated quantity (lots × 50 for Nifty)
    const result = await placeOrderForUser(user, order);
    results.push(result);
  }
}
```

**Lot-Based:** Uses `subscription.lotSize` and `subscription.quantity`

## Order Execution Logic

### Integration-Managed Users (Simulated)

```javascript
async function placeOrderForUser(user, symbol, action, price, stopLoss) {
  const isIntegrationManaged = user.password === "INTEGRATION_MANAGED";
  
  if (isIntegrationManaged) {
    console.log(`📋 Integration-managed user ${user.clientName} - simulating order`);
    return {
      success: true,
      simulated: true,
      message: `Order simulated for ${user.clientName}`
    };
  }
  
  // Real order execution...
}
```

### Real Users (IIFL API)

```javascript
async function placeOrderForUser(user, symbol, action, price, stopLoss) {
  // Validate token
  if (!user.token || user.token === "INTEGRATION_PLACEHOLDER_TOKEN") {
    return { success: false, error: "Missing valid token" };
  }
  
  // Calculate quantity
  const quantity = Math.floor(capital / price);
  
  // Get instrument ID
  const instrumentId = await getInstrumentID(symbol);
  
  // Place order via IIFL API
  const response = await axios.post(`${IIFL_BASE_URL}/orders`, orderPayload, {
    headers: { "Authorization": `Bearer ${user.token}` }
  });
  
  return { success: true, data: response.data };
}
```

## Benefits of This Architecture

✅ **Unified System:** All 3 strategies use same pattern
✅ **Subscription-Based:** Users can subscribe to multiple strategies with different configs
✅ **Capital Allocation:** Each strategy can have different capital/lot size
✅ **Integration Support:** Seamlessly handles both real and integration-managed users
✅ **Scalable:** Easy to add new strategies
✅ **Maintainable:** Single source of truth (subscriptionManager)
✅ **Secure:** Tokens managed centrally, refreshed automatically

## Database Schema

### IIFLUser (Shared across all strategies)
```sql
- userID (PK)
- clientName
- email
- password ("INTEGRATION_MANAGED" for integration users)
- token (session token or placeholder)
- tokenValidity
- state ("live" or "inactive")
- appKey, appSecret, totpSecret (for real users)
```

### Strategy Subscriptions (One table per strategy)
```sql
- id (PK)
- userID (FK → IIFLUser)
- enabled (boolean)
- capital (for Epicrise)
- lotSize (for BankNifty/OptionTrade)
- maxPositions
- riskPerTrade
- customSettings (JSON)
```

## Next Steps

1. ✅ All strategies now use `subscriptionManager.getSubscribedUsers()`
2. ✅ Integration-managed users are supported
3. ✅ Real users with broker credentials are supported
4. 🔄 Test end-to-end flow for all 3 strategies
5. 🔄 Verify MongoDB symbol lookup is working
6. 🔄 Test token refresh cron job

## Testing

### Test Integration-Managed User
```bash
# 1. Create user via frontend integration API
POST /api/integration/broker/register
{
  "userId": "test-user-123",
  "strategyType": "EPICRISE",
  "clientId": "28748327",
  "brokerType": "IIFL"
}

# 2. Configure strategy
POST /api/integration/configure-strategy
{
  "userId": "test-user-123",
  "strategyType": "EPICRISE",
  "capital": 50000
}

# 3. Send trading signal
POST /Epicrise
"ER Buy SULA at 250.00 with Stop Loss at 220.10"

# Expected: Order simulated successfully
```

### Test Real User
```bash
# 1. User logs in via IIFL (gets real token)
# 2. Create subscription
# 3. Send trading signal
# Expected: Real order placed via IIFL API
```

