# OptionTrade Strategy - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start the Server
```bash
cd d:\07.11.25\epicrisenew
npm start
```

You should see:
```
Server is running on port 3000
MongoDB connected successfully
```

### Step 2: Test the Health Check
Open a new terminal and run:
```bash
curl http://localhost:3000/OptionTrade/health
```

Expected response:
```json
{
  "success": true,
  "message": "Option Trade strategy is running",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "brokers": ["IIFL"]
}
```

### Step 3: Send a BB TRAP Signal
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d "{\"messageText\": \"BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2\"}"
```

## 📊 What Happens

1. **Signal Parsed** ✅
   ```
   Action: BUY
   Symbol: NIFTY1!
   Entry: 25560.2
   Stop Loss: 25520.2
   Target: 25640.2
   ```

2. **Option Chain Fetched** ✅
   ```
   Underlying: NIFTY
   Last Price: 25487.6
   Expiry: 2025-11-11
   ```

3. **Delta 0.50 Strikes Found** ✅
   ```
   CE Strike: 25500 (Delta: 0.54, Price: ₹90.15, ID: 40095)
   PE Strike: 25500 (Delta: -0.47, Price: ₹75.50, ID: 40096)
   ```

4. **Orders Placed** ✅
   ```
   Order 1: BUY CE Strike 25500 at ₹90.15
   Order 2: SELL PE Strike 25500 at ₹75.50
   ```

5. **Trade Saved** ✅
   ```
   Database: MongoDB
   Status: ACTIVE
   Trade ID: 673c8f9a1234567890abcdef
   ```

## 🧪 Run Automated Tests

```bash
cd d:\07.11.25\epicrisenew\Strategies\OptionTrade
node test.js
```

This will test:
- ✅ Health check
- ✅ IIFL health check
- ✅ Buy signal processing
- ✅ Sell signal processing
- ✅ Invalid signal handling

## 📝 Signal Format

### Buy Signal
```
BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2
```

**Result**: BUY CE + SELL PE

### Sell Signal
```
BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2
```

**Result**: SELL CE + BUY PE

## 🔍 Monitor Trades

### Check Logs
Watch the console for detailed logs:
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

console.log(trades);
```

## ⚠️ Troubleshooting

### Server Not Starting
```bash
# Check if port 3000 is already in use
netstat -ano | findstr :3000

# Kill the process if needed
taskkill /PID <PID> /F
```

### Health Check Fails
```bash
# Check if server is running
curl http://localhost:3000/OptionTrade/health

# Check server logs for errors
```

### Signal Processing Fails
1. **Check Dhan API credentials** in `.env`
2. **Verify data.csv** exists with security IDs
3. **Check MongoDB** connection
4. **Review logs** for detailed error messages

## 📚 More Information

- **Full Documentation**: `README.md`
- **Test Suite**: `test.js`
- **Setup Guide**: `../../../OPTIONTRADE_SETUP_COMPLETE.md`

## 🎯 Key Points

✅ **Isolated from Epic Rise** - No impact on main system
✅ **Automatic Processing** - Just send BB TRAP signals
✅ **Real-time Data** - Fetches live option chain
✅ **Delta 0.50 Selection** - Optimal strike selection
✅ **Database Recording** - All trades saved
✅ **Error Handling** - Robust fallback mechanisms

## 🎉 You're Ready!

Send BB TRAP signals to:
```
POST http://localhost:3000/OptionTrade/IIFL
```

The system will automatically:
1. Parse the signal
2. Fetch option chain
3. Find delta 0.50 strikes
4. Place CE and PE orders
5. Save to database

**Happy Trading! 🚀**

