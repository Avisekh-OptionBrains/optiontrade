# OptionTrade Strategy - BB TRAP Option Trading

## 📋 Overview

The **OptionTrade** strategy is a completely separate and independent trading system designed to handle **BB TRAP** signals and automatically place option orders via IIFL broker.

This strategy is **isolated from Epic Rise** to prevent any load or interference with the main Epic Rise trading system.

## 🎯 Purpose

- **Dedicated BB TRAP Handler**: Processes only BB TRAP signals
- **Option Trading**: Automatically places CE and PE option orders
- **Delta 0.50 Selection**: Finds optimal strikes with delta closest to 0.50
- **Real-time Data**: Fetches live option chain data from Dhan API
- **Database Recording**: Saves all trades to MongoDB

## 🚀 Endpoints

### Main Webhook Endpoint
```
POST /OptionTrade
```

**Request Body:**
```json
{
  "messageText": "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Option trade processed",
  "broker": "IIFL",
  "result": {
    "signal": { ... },
    "orders": [ ... ],
    "results": [ ... ]
  }
}
```

### IIFL Broker Endpoint
```
POST /OptionTrade/IIFL
```

Same request/response format as main endpoint.

### Health Check
```
GET /OptionTrade/health
```

**Response:**
```json
{
  "success": true,
  "message": "Option Trade strategy is running",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "brokers": ["IIFL"]
}
```

## 📊 Trading Logic

### Signal Format
```
BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2
BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2
```

### Order Placement Logic

| Signal Type | CE Action | PE Action | Strategy |
|-------------|-----------|-----------|----------|
| **BUY**     | BUY       | SELL      | Bullish synthetic long |
| **SELL**    | SELL      | BUY       | Bearish synthetic short |

### Delta Selection
- **CE (Call)**: Finds strike with delta closest to **+0.50**
- **PE (Put)**: Finds strike with delta closest to **-0.50**

### Price Selection
- Uses **top_ask_price** from Dhan option chain
- All prices rounded to 2 decimal places

## 🗂️ File Structure

```
epicrisenew/Strategies/OptionTrade/
├── index.js                              # Main strategy router
├── README.md                             # This file
└── Brokers/
    └── IIFL/
        ├── IIFL.js                       # IIFL broker handler
        ├── optionTradingHandler.js       # Core trading logic
        └── dhanClient.js                 # Dhan API client
```

## 🔧 Configuration

### Environment Variables
```env
ACCESS_TOKEN=your_dhan_access_token
CLIENT_ID=your_dhan_client_id
IIFL_ENDPOINT=http://localhost:3000/Epicrise/IIFL
```

### CSV Data File
Location: `d:\07.11.25\data.csv`

Required columns:
- Column 2: SECURITY_ID
- Column 13: STRIKE_PRICE
- Column 14: OPTION_TYPE (CE or PE)

## 📝 Example Flow

### 1. Signal Received
```
BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2
```

### 2. Signal Parsed
```json
{
  "action": "buy",
  "symbol": "NIFTY1!",
  "entryPrice": 25560.2,
  "stopLoss": 25520.2,
  "target": 25640.2
}
```

### 3. Option Chain Fetched
```
Underlying: NIFTY
Last Price: 25487.6
Expiry: 2025-11-11
Total Strikes: 231
```

### 4. Delta 0.50 Strikes Found
```json
{
  "ce": {
    "strike": 25500,
    "delta": 0.54,
    "top_ask_price": 90.15,
    "security_id": 40095
  },
  "pe": {
    "strike": 25500,
    "delta": -0.47,
    "top_ask_price": 75.50,
    "security_id": 40096
  }
}
```

### 5. Orders Placed
```
Order 1: BUY CE Strike 25500 at ₹90.15 (Security ID: 40095)
Order 2: SELL PE Strike 25500 at ₹75.50 (Security ID: 40096)
```

### 6. Trade Saved to Database
```json
{
  "strategy": "BB TRAP",
  "signal": { ... },
  "orders": [ ... ],
  "results": [ ... ],
  "status": "ACTIVE"
}
```

## 🔍 Monitoring

### Check Logs
All operations are logged with detailed information:
```
=== BB TRAP SIGNAL PROCESSOR ===
Received Signal: BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2
✅ Signal parsed successfully
✅ Option chain fetched
✅ Orders placed
✅ Trade saved to database
```

### Query Database
```javascript
const Trade = require('../../../models/Trade');

// Get all BB TRAP trades
const trades = await Trade.find({ strategy: 'BB TRAP' })
  .sort({ createdAt: -1 });

// Get today's trades
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayTrades = await Trade.find({ 
  strategy: 'BB TRAP',
  createdAt: { $gte: today } 
});
```

## 🧪 Testing

### Test Health Check
```bash
curl http://localhost:3000/OptionTrade/health
```

### Test BB TRAP Signal
```bash
curl -X POST http://localhost:3000/OptionTrade \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"}'
```

### Test IIFL Endpoint
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"}'
```

## ⚠️ Important Notes

1. **Isolated System**: This strategy is completely separate from Epic Rise
2. **No Load on Epic Rise**: All BB TRAP processing happens independently
3. **Dhan API Rate Limit**: 1 request per 3 seconds
4. **Security IDs Required**: Must be present in `data.csv`
5. **MongoDB Required**: Falls back to JSON file if DB unavailable

## 🔧 Troubleshooting

### Signal Not Processed
- Check if message contains "BB TRAP"
- Verify signal format matches regex pattern
- Check logs for parsing errors

### Option Chain Fetch Failed
- Verify Dhan API credentials in `.env`
- Check rate limiting (1 req/3 sec)
- Ensure network connectivity

### Order Placement Failed
- Verify IIFL endpoint is running
- Check security IDs in CSV
- Review IIFL broker logs

### Database Save Failed
- Check MongoDB connection
- Verify Trade model is imported
- Check fallback JSON file: `trades_backup.json`

## 📊 Database Schema

```javascript
{
  strategy: "BB TRAP",
  signal: {
    action: "buy",
    symbol: "NIFTY1!",
    entryPrice: 25560.2,
    stopLoss: 25520.2,
    target: 25640.2
  },
  orders: [
    {
      type: "CE",
      action: "BUY",
      strike: 25500,
      delta: 0.54,
      price: 90.15,
      security_id: 40095
    },
    {
      type: "PE",
      action: "SELL",
      strike: 25500,
      delta: -0.47,
      price: 75.50,
      security_id: 40096
    }
  ],
  results: [
    {
      success: true,
      order: { ... },
      response: { ... }
    }
  ],
  status: "ACTIVE",
  createdAt: "2025-11-07T10:30:00.000Z",
  updatedAt: "2025-11-07T10:30:00.000Z"
}
```

## ✅ Benefits of Separate Strategy

1. **No Impact on Epic Rise**: Completely isolated processing
2. **Independent Scaling**: Can scale separately if needed
3. **Easier Debugging**: Logs are separate and focused
4. **Flexible Configuration**: Can configure independently
5. **Better Monitoring**: Dedicated health checks and metrics

## 🎉 Ready to Use

The OptionTrade strategy is now registered and ready to receive BB TRAP signals at:

```
POST http://localhost:3000/OptionTrade
POST http://localhost:3000/OptionTrade/IIFL
```

Send BB TRAP signals to these endpoints and the system will automatically:
1. Parse the signal
2. Fetch option chain data
3. Find delta 0.50 strikes
4. Place CE and PE orders
5. Save to database

**No load on Epic Rise!** 🚀

