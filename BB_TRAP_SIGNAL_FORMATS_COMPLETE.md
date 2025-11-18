# BB TRAP Signal Formats - Complete Reference

## 📋 Overview

This document provides a complete reference for all BB TRAP signal formats supported by both **BankNifty** and **OptionTrade** strategies.

---

## 🏦 BANK NIFTY SIGNALS

### 📥 Entry Signals

#### PINE SCRIPT FORMAT (Primary - from TradingView)

**1. BUY Signal**
```
BB TRAP Buy BANKNIFTY at 51590.5 | SL: 51550.5 | Target: 51650.5
```
- **Source:** Pine Script "Brain Wave Bank Nifty" strategy
- **Action:** BUY (Synthetic Long)
- **CE:** BUY
- **PE:** SELL

**2. SELL Signal**
```
BB TRAP Sell BANKNIFTY at 51590.5 | SL: 51630.5 | Target: 51510.5
```
- **Source:** Pine Script "Brain Wave Bank Nifty" strategy
- **Action:** SELL (Synthetic Short)
- **CE:** SELL
- **PE:** BUY

#### LEGACY FORMAT (Still Supported)

**3. BUY Signal (Bear Trap)**
```
BANKNIFTY | Bear Trap | Entry at 51590.5 | SL: 51550.5 | Target: 51650.5
```

**4. SELL Signal (Bull Trap)**
```
BANKNIFTY | Bull Trap | Entry at 51590.5 | SL: 51630.5 | Target: 51510.5
```

### 📤 Exit Signals

#### PINE SCRIPT FORMAT (Primary - from TradingView)

**5. LONG EXIT (Buy Position)**
```
BB TRAP Exit Long BANKNIFTY at 51550.5
```
- **Source:** Pine Script - Triggered when long position closes (SL/Target/3PM)
- **Action:** Square off BUY position (SELL CE, BUY PE)

**6. SHORT EXIT (Sell Position)**
```
BB TRAP Exit Short BANKNIFTY at 51630.5
```
- **Source:** Pine Script - Triggered when short position closes (SL/Target/3PM)
- **Action:** Square off SELL position (BUY CE, SELL PE)

#### LEGACY FORMAT (Still Supported)

**7. LONG EXIT - SL Hit**
```
BB TRAP LONG EXIT (SL HIT) BANKNIFTY at 51550.5
```

**8. LONG EXIT - Target Hit**
```
BB TRAP LONG EXIT (TARGET HIT) BANKNIFTY at 51650.5
```

**9. LONG EXIT - 3PM Exit**
```
BB TRAP LONG EXIT (3PM EXIT) BANKNIFTY at 51590.5
```

**10. SHORT EXIT - SL Hit**
```
BB TRAP SHORT EXIT (SL HIT) BANKNIFTY at 51630.5
```

**11. SHORT EXIT - Target Hit**
```
BB TRAP SHORT EXIT (TARGET HIT) BANKNIFTY at 51510.5
```

**12. SHORT EXIT - 3PM Exit**
```
BB TRAP SHORT EXIT (3PM EXIT) BANKNIFTY at 51590.5
```

**13. Exit with Direction**
```
BB TRAP Exit Buy BANKNIFTY at 51550.5 | SL Hit
BB TRAP Exit Sell BANKNIFTY at 51630.5 | Target Hit
```

**14. Exit without Direction**
```
BB TRAP Exit BANKNIFTY at 51590.5 | Intraday Exit
BB TRAP Exit BANKNIFTY at 51590.5 | End of Day Exit
```

---

## 📊 OPTION TRADE (NIFTY) SIGNALS

### 📥 Entry Signals

#### PINE SCRIPT FORMAT (Primary - from TradingView)

**1. BUY Signal**
```
BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2
```
- **Source:** Pine Script "Brain Wave Nifty" strategy
- **Action:** BUY
- **CE:** BUY
- **PE:** SELL

**2. SELL Signal**
```
BB TRAP Sell NIFTY1! at 25560.2 | SL: 25600.2 | Target: 25480.2
```
- **Source:** Pine Script "Brain Wave Nifty" strategy
- **Action:** SELL
- **CE:** SELL
- **PE:** BUY

### 📤 Exit Signals

#### PINE SCRIPT FORMAT (Primary - from TradingView)

**3. LONG EXIT (Buy Position)**
```
BB TRAP LONG EXIT NIFTY1! at 25520.2
```
- **Source:** Pine Script - Triggered when long position closes
- **Action:** Square off BUY position (SELL CE, BUY PE)

**4. SHORT EXIT (Sell Position)**
```
BB TRAP SHORT EXIT NIFTY1! at 25600.2
```
- **Source:** Pine Script - Triggered when short position closes
- **Action:** Square off SELL position (BUY CE, SELL PE)

**5. LONG EXIT with Reason**
```
BB TRAP LONG EXIT (3PM Exit) NIFTY1! at 25580.2
BB TRAP LONG EXIT (EOD Exit) NIFTY1! at 25580.2
```
- **Source:** Pine Script - Exit at specific time
- **Action:** Square off BUY position

**6. SHORT EXIT with Reason**
```
BB TRAP SHORT EXIT (3PM Exit) NIFTY1! at 25580.2
BB TRAP SHORT EXIT (EOD Exit) NIFTY1! at 25580.2
```
- **Source:** Pine Script - Exit at specific time
- **Action:** Square off SELL position

#### LEGACY FORMAT (Still Supported)

**7. Exit Buy - SL Hit**
```
BB TRAP Exit Buy NIFTY1! at 25520.2 | SL Hit
```

**8. Exit Buy - Target Hit**
```
BB TRAP Exit Buy NIFTY1! at 25640.2 | Target Hit
```

**9. Exit Buy - Manual Exit**
```
BB TRAP Exit Buy NIFTY1! at 25590.2 | Exit
```

**10. Exit Sell - SL Hit**
```
BB TRAP Exit Sell NIFTY1! at 25600.2 | SL Hit
```

**11. Exit Sell - Target Hit**
```
BB TRAP Exit Sell NIFTY1! at 25480.2 | Target Hit
```

**12. Exit Sell - Manual Exit**
```
BB TRAP Exit Sell NIFTY1! at 25550.2 | Exit
```

**13. Intraday Exit**
```
BB TRAP Exit NIFTY1! at 25580.2 | Intraday Exit
```

**14. End of Day Exit**
```
BB TRAP Exit NIFTY1! at 25580.2 | End of Day Exit
```

---

## 📡 API Endpoints

### BankNifty
```
POST http://localhost:3000/BankNifty/IIFL
Content-Type: application/json

{
  "messageText": "BANKNIFTY | Bear Trap | Entry at 51590.5 | SL: 51550.5 | Target: 51650.5"
}
```

### OptionTrade
```
POST http://localhost:3000/OptionTrade/IIFL
Content-Type: application/json

{
  "messageText": "BB TRAP Buy NIFTY1! at 25560.2 | SL: 25520.2 | Target: 25640.2"
}
```

---

## 🎯 Key Differences

| Feature | BankNifty | OptionTrade |
|---------|-----------|-------------|
| **Ticker** | BANKNIFTY, BANKNIFTY1! | NIFTY, NIFTY1! |
| **Pine Script** | Brain Wave Bank Nifty (18bank.11.25) | Brain Wave Nifty (18.11.25) |
| **Entry Format** | Pine Script + Legacy (Bear/Bull Trap) | Pine Script + Legacy |
| **Exit Format** | Pine Script (Exit Long/Short) + Legacy | Pine Script (LONG/SHORT EXIT) + Legacy |
| **Lot Size** | 35 qty per lot | 75 qty per lot |
| **Total Formats** | 14 | 14 |
| **Keywords** | BB TRAP, Bear Trap, Bull Trap, Exit Long, Exit Short | BB TRAP, LONG EXIT, SHORT EXIT |

---

## ✅ Testing

### BankNifty Pine Script Parsing
```bash
node test-pine-parsing-unit.js
```
**Coverage:** 6/6 tests passing ✅
- ✅ Pine Script Buy Entry
- ✅ Pine Script Sell Entry
- ✅ Pine Script Exit Long
- ✅ Pine Script Exit Short
- ✅ Legacy Bear Trap
- ✅ Legacy Bull Trap

### OptionTrade Pine Script Parsing
```bash
node test-optiontrade-pine-parsing.js
```
**Coverage:** 8/8 tests passing ✅
- ✅ Pine Script Buy Entry
- ✅ Pine Script Sell Entry
- ✅ Pine Script LONG EXIT (simple)
- ✅ Pine Script SHORT EXIT (simple)
- ✅ Pine Script LONG EXIT (3PM Exit)
- ✅ Pine Script SHORT EXIT (EOD Exit)
- ✅ Legacy Exit Buy with SL Hit
- ✅ Legacy Exit without Direction

### Legacy Tests
**BankNifty:**
```bash
node Strategies/BankNifty/test-new-format.js
```
**Coverage:** 11/11 tests passing ✅

**OptionTrade:**
```bash
node Strategies/OptionTrade/test-signal-formats.js
```
**Coverage:** 10/10 tests passing ✅

---

## 📝 Notes

1. **Case Insensitive:** All signal parsing is case-insensitive
2. **Whitespace Tolerant:** Extra spaces are handled gracefully
3. **Backward Compatible:** Old formats still work for BankNifty
4. **Symbol Variations:** Both "BANKNIFTY" and "BANKNIFTY1!" are supported
5. **Exit Types:**
   - **SL Hit** - Stop Loss triggered
   - **Target Hit** - Target price reached
   - **Exit** - Manual exit
   - **3PM EXIT** - Intraday exit at 3 PM
   - **Intraday Exit** - Exit during trading hours
   - **End of Day Exit** - Exit at market close


