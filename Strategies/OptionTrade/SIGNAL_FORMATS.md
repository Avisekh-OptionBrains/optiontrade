# OptionTrade BB TRAP Signal Formats

## 📋 Overview
This document describes all supported BB TRAP signal formats for the OptionTrade strategy (NIFTY options).

## 📥 Entry Signals

### 1. Buy Entry Signal
```
BB TRAP Buy <TICKER> at <PRICE> | SL: <SL_PRICE> | Target: <TARGET_PRICE>
```

**Example:**
```
BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2
```

**Interpretation:**
- Opens a BUY position in NIFTY options
- Entry price: 25560.2
- Stop Loss: 25520.2
- Target: 25640.2

### 2. Sell Entry Signal
```
BB TRAP Sell <TICKER> at <PRICE> | SL: <SL_PRICE> | Target: <TARGET_PRICE>
```

**Example:**
```
BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2
```

**Interpretation:**
- Opens a SELL position in NIFTY options
- Entry price: 25560.2
- Stop Loss: 25600.2
- Target: 25480.2

---

## 📤 Exit Signals

### Exit Signals with Direction (Buy/Sell)

#### 3. Exit Buy - SL Hit
```
BB TRAP Exit Buy <TICKER> at <EXIT_PRICE> | SL Hit
```

**Example:**
```
BB TRAP Exit Buy NIFTY1! at 25520.2 | SL Hit
```

**Interpretation:**
- Exits a BUY position
- Stop Loss was triggered
- Exit price: 25520.2

#### 4. Exit Buy - Target Hit
```
BB TRAP Exit Buy <TICKER> at <EXIT_PRICE> | Target Hit
```

**Example:**
```
BB TRAP Exit Buy NIFTY1! at 25640.2 | Target Hit
```

**Interpretation:**
- Exits a BUY position
- Target was reached
- Exit price: 25640.2

#### 5. Exit Buy - Manual Exit
```
BB TRAP Exit Buy <TICKER> at <EXIT_PRICE> | Exit
```

**Example:**
```
BB TRAP Exit Buy NIFTY1! at 25590.2 | Exit
```

**Interpretation:**
- Exits a BUY position
- Manual exit (neither SL nor Target)
- Exit price: 25590.2

#### 6. Exit Sell - SL Hit
```
BB TRAP Exit Sell <TICKER> at <EXIT_PRICE> | SL Hit
```

**Example:**
```
BB TRAP Exit Sell NIFTY1! at 25600.2 | SL Hit
```

**Interpretation:**
- Exits a SELL position
- Stop Loss was triggered
- Exit price: 25600.2

#### 7. Exit Sell - Target Hit
```
BB TRAP Exit Sell <TICKER> at <EXIT_PRICE> | Target Hit
```

**Example:**
```
BB TRAP Exit Sell NIFTY1! at 25480.2 | Target Hit
```

**Interpretation:**
- Exits a SELL position
- Target was reached
- Exit price: 25480.2

#### 8. Exit Sell - Manual Exit
```
BB TRAP Exit Sell <TICKER> at <EXIT_PRICE> | Exit
```

**Example:**
```
BB TRAP Exit Sell NIFTY1! at 25550.2 | Exit
```

**Interpretation:**
- Exits a SELL position
- Manual exit (neither SL nor Target)
- Exit price: 25550.2

### Exit Signals without Direction

#### 9. Intraday Exit
```
BB TRAP Exit <TICKER> at <PRICE> | Intraday Exit
```

**Example:**
```
BB TRAP Exit NIFTY1! at 25580.2 | Intraday Exit
```

**Interpretation:**
- Exits all positions for the ticker
- Intraday exit (during trading hours)
- Exit price: 25580.2

#### 10. End of Day Exit
```
BB TRAP Exit <TICKER> at <PRICE> | End of Day Exit
```

**Example:**
```
BB TRAP Exit NIFTY1! at 25580.2 | End of Day Exit
```

**Interpretation:**
- Exits all positions for the ticker
- End of day exit (market close)
- Exit price: 25580.2

---

## 📊 Signal Summary Table

| # | Signal Type | Direction | Exit Reason | Format |
|---|-------------|-----------|-------------|--------|
| 1 | Entry | Buy | - | `BB TRAP Buy <TICKER> at <PRICE> \| SL: <SL> \| Target: <TARGET>` |
| 2 | Entry | Sell | - | `BB TRAP Sell <TICKER> at <PRICE> \| SL: <SL> \| Target: <TARGET>` |
| 3 | Exit | Buy | SL Hit | `BB TRAP Exit Buy <TICKER> at <PRICE> \| SL Hit` |
| 4 | Exit | Buy | Target Hit | `BB TRAP Exit Buy <TICKER> at <PRICE> \| Target Hit` |
| 5 | Exit | Buy | Manual | `BB TRAP Exit Buy <TICKER> at <PRICE> \| Exit` |
| 6 | Exit | Sell | SL Hit | `BB TRAP Exit Sell <TICKER> at <PRICE> \| SL Hit` |
| 7 | Exit | Sell | Target Hit | `BB TRAP Exit Sell <TICKER> at <PRICE> \| Target Hit` |
| 8 | Exit | Sell | Manual | `BB TRAP Exit Sell <TICKER> at <PRICE> \| Exit` |
| 9 | Exit | Any | Intraday | `BB TRAP Exit <TICKER> at <PRICE> \| Intraday Exit` |
| 10 | Exit | Any | End of Day | `BB TRAP Exit <TICKER> at <PRICE> \| End of Day Exit` |

---

## ✅ Testing

A comprehensive test suite validates all 10 signal formats.

**Run tests:**
```bash
node Strategies/OptionTrade/test-signal-formats.js
```

**Test Coverage:** All 10 formats ✅
- ✅ BB TRAP Buy Entry Signal
- ✅ BB TRAP Sell Entry Signal
- ✅ BB TRAP Exit Buy - SL Hit
- ✅ BB TRAP Exit Buy - Target Hit
- ✅ BB TRAP Exit Buy - Exit
- ✅ BB TRAP Exit Sell - SL Hit
- ✅ BB TRAP Exit Sell - Target Hit
- ✅ BB TRAP Exit Sell - Exit
- ✅ BB TRAP Exit - Intraday Exit
- ✅ BB TRAP Exit - End of Day Exit

All tests passing: **10/10** ✅

---

## 🚀 Usage Examples

### Send Entry Signal (Buy)
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"}'
```

### Send Entry Signal (Sell)
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2"}'
```

### Send Exit Signal (SL Hit)
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Exit Buy NIFTY1! at 25520.2 | SL Hit"}'
```

### Send Exit Signal (Target Hit)
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Exit Buy NIFTY1! at 25640.2 | Target Hit"}'
```

### Send Exit Signal (Manual Exit)
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Exit Buy NIFTY1! at 25590.2 | Exit"}'
```

### Send Exit Signal (Intraday Exit)
```bash
curl -X POST http://localhost:3000/OptionTrade/IIFL \
  -H "Content-Type: application/json" \
  -d '{"messageText": "BB TRAP Exit NIFTY1! at 25580.2 | Intraday Exit"}'
```

---

## 📝 Notes

1. **Case Insensitive:** Signal parsing is case-insensitive
2. **Whitespace Tolerant:** Extra spaces around delimiters are handled gracefully
3. **Ticker Format:** Supports both "NIFTY" and "NIFTY1!" ticker formats
4. **Exit Types:**
   - **With Direction:** Specifies Buy/Sell and reason (SL Hit, Target Hit, Exit)
   - **Without Direction:** Used for Intraday Exit and End of Day Exit (closes all positions)
5. **Exit Reasons:**
   - `SL Hit` - Stop Loss triggered
   - `Target Hit` - Target price reached
   - `Exit` - Manual exit
   - `Intraday Exit` - Exit during trading hours
   - `End of Day Exit` - Exit at market close

---

## 🔍 Signal Detection

The system detects BB TRAP signals by checking for the keyword `BB TRAP` in the message text.

**Supported Keywords:**
- `BB TRAP` (required for all signals)

**Signal Processing:**
1. Message received via webhook
2. Keyword detection (`BB TRAP`)
3. Signal parsing (extract action, symbol, prices)
4. User lookup (find active users)
5. Order execution (place orders via IIFL API)
6. Database update (save trade records)
7. Notification (send confirmation to users)

---

## 🎯 Trading Logic

### Entry Signals
| Signal | Action | Order Type |
|--------|--------|------------|
| BB TRAP Buy | BUY | Market/Limit Order |
| BB TRAP Sell | SELL | Market/Limit Order |

### Exit Signals
| Signal | Action | Order Type |
|--------|--------|------------|
| BB TRAP Exit Buy | Square off BUY position | Market Order |
| BB TRAP Exit Sell | Square off SELL position | Market Order |
| BB TRAP Exit (no direction) | Square off all positions | Market Order |

---

## 📡 API Endpoint

```
POST http://localhost:3000/OptionTrade/IIFL
Content-Type: application/json

{
  "messageText": "<SIGNAL_STRING>"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signal processed successfully",
  "data": {
    "action": "buy",
    "symbol": "NIFTY1!",
    "entryPrice": 25560.2,
    "stopLoss": 25520.2,
    "target": 25640.2
  }
}
```

