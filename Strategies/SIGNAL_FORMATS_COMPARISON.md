# BB TRAP Signal Formats Comparison

## 📋 Overview
This document compares the signal formats used by BankNifty and OptionTrade strategies.

---

## 🏦 BankNifty Strategy (BANKNIFTY Options)

### Entry Signals

#### NEW FORMAT (Recommended)
| Signal Type | Format | Example |
|-------------|--------|---------|
| **BUY (Bear Trap)** | `<TICKER> \| Bear Trap \| Entry at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BANKNIFTY \| Bear Trap \| Entry at 51590.5 \| SL: 51550.5 \| Target: 51650.5` |
| **SELL (Bull Trap)** | `<TICKER> \| Bull Trap \| Entry at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BANKNIFTY \| Bull Trap \| Entry at 51590.5 \| SL: 51630.5 \| Target: 51510.5` |

#### OLD FORMAT (Still Supported)
| Signal Type | Format | Example |
|-------------|--------|---------|
| **BUY** | `BB TRAP Buy <TICKER> at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BB TRAP Buy BANKNIFTY at 51590.5 \| SL: 51550.5 \| Target: 51650.5` |
| **SELL** | `BB TRAP Sell <TICKER> at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BB TRAP Sell BANKNIFTY at 51590.5 \| SL: 51630.5 \| Target: 51510.5` |

### Exit Signals

#### NEW FORMAT (Recommended)
| Exit Type | Format | Example |
|-----------|--------|---------|
| **LONG EXIT (SL)** | `BB TRAP LONG EXIT (SL HIT) <TICKER> at <PRICE>` | `BB TRAP LONG EXIT (SL HIT) BANKNIFTY at 51550.5` |
| **LONG EXIT (Target)** | `BB TRAP LONG EXIT (TARGET HIT) <TICKER> at <PRICE>` | `BB TRAP LONG EXIT (TARGET HIT) BANKNIFTY at 51650.5` |
| **LONG EXIT (3PM)** | `BB TRAP LONG EXIT (3PM EXIT) <TICKER> at <PRICE>` | `BB TRAP LONG EXIT (3PM EXIT) BANKNIFTY at 51590.5` |
| **SHORT EXIT (SL)** | `BB TRAP SHORT EXIT (SL HIT) <TICKER> at <PRICE>` | `BB TRAP SHORT EXIT (SL HIT) BANKNIFTY at 51630.5` |
| **SHORT EXIT (Target)** | `BB TRAP SHORT EXIT (TARGET HIT) <TICKER> at <PRICE>` | `BB TRAP SHORT EXIT (TARGET HIT) BANKNIFTY at 51510.5` |
| **SHORT EXIT (3PM)** | `BB TRAP SHORT EXIT (3PM EXIT) <TICKER> at <PRICE>` | `BB TRAP SHORT EXIT (3PM EXIT) BANKNIFTY at 51590.5` |

#### OLD FORMAT (Still Supported)
| Exit Type | Format | Example |
|-----------|--------|---------|
| **With Direction** | `BB TRAP Exit <Buy\|Sell> <TICKER> at <PRICE> \| <Reason>` | `BB TRAP Exit Buy BANKNIFTY at 51550.5 \| SL Hit` |
| **Without Direction** | `BB TRAP Exit <TICKER> at <PRICE> \| <Reason>` | `BB TRAP Exit BANKNIFTY at 51590.5 \| Intraday Exit` |

**Keywords Recognized:** `BB TRAP`, `Bear Trap`, `Bull Trap`, `LONG EXIT`, `SHORT EXIT`

---

## 📊 OptionTrade Strategy (NIFTY Options)

### Entry Signals
| Signal Type | Format | Example |
|-------------|--------|---------|
| **BUY** | `BB TRAP Buy <TICKER> at <PRICE> \| SL: <SL> \| Target: <TARGET>` | `BB TRAP Buy NIFTY1! at 25560.2 \| SL: 25520.2 \| Target: 25640.2` |
| **SELL** | `BB TRAP Sell <TICKER> at <PRICE> \| SL: <SL> \| Target: <TARGET>` | `BB TRAP Sell NIFTY1! at 25560.2 \| SL: 25600.2 \| Target: 25480.2` |

### Exit Signals

#### With Direction
| Exit Type | Format | Example |
|-----------|--------|---------|
| **Exit Buy (SL)** | `BB TRAP Exit Buy <TICKER> at <PRICE> \| SL Hit` | `BB TRAP Exit Buy NIFTY1! at 25520.2 \| SL Hit` |
| **Exit Buy (Target)** | `BB TRAP Exit Buy <TICKER> at <PRICE> \| Target Hit` | `BB TRAP Exit Buy NIFTY1! at 25640.2 \| Target Hit` |
| **Exit Buy (Manual)** | `BB TRAP Exit Buy <TICKER> at <PRICE> \| Exit` | `BB TRAP Exit Buy NIFTY1! at 25590.2 \| Exit` |
| **Exit Sell (SL)** | `BB TRAP Exit Sell <TICKER> at <PRICE> \| SL Hit` | `BB TRAP Exit Sell NIFTY1! at 25600.2 \| SL Hit` |
| **Exit Sell (Target)** | `BB TRAP Exit Sell <TICKER> at <PRICE> \| Target Hit` | `BB TRAP Exit Sell NIFTY1! at 25480.2 \| Target Hit` |
| **Exit Sell (Manual)** | `BB TRAP Exit Sell <TICKER> at <PRICE> \| Exit` | `BB TRAP Exit Sell NIFTY1! at 25550.2 \| Exit` |

#### Without Direction
| Exit Type | Format | Example |
|-----------|--------|---------|
| **Intraday Exit** | `BB TRAP Exit <TICKER> at <PRICE> \| Intraday Exit` | `BB TRAP Exit NIFTY1! at 25580.2 \| Intraday Exit` |
| **End of Day Exit** | `BB TRAP Exit <TICKER> at <PRICE> \| End of Day Exit` | `BB TRAP Exit NIFTY1! at 25580.2 \| End of Day Exit` |

**Keywords Recognized:** `BB TRAP`

---

## 🔄 Key Differences

| Feature | BankNifty | OptionTrade |
|---------|-----------|-------------|
| **Ticker** | BANKNIFTY | NIFTY, NIFTY1! |
| **Entry Format** | NEW: Bear/Bull Trap<br>OLD: BB TRAP Buy/Sell | BB TRAP Buy/Sell |
| **Exit Format** | NEW: LONG/SHORT EXIT<br>OLD: BB TRAP Exit | BB TRAP Exit Buy/Sell |
| **Exit Reasons** | SL HIT, TARGET HIT, 3PM EXIT | SL Hit, Target Hit, Exit, Intraday Exit, End of Day Exit |
| **Keywords** | BB TRAP, Bear Trap, Bull Trap, LONG EXIT, SHORT EXIT | BB TRAP |
| **Position Type** | Synthetic (CE + PE) | Direct Options |

---

## 📊 Signal Mapping

### BankNifty
| New Format | Old Format | Action | Position |
|------------|------------|--------|----------|
| Bear Trap | BB TRAP Buy | BUY | Synthetic Long (BUY CE + SELL PE) |
| Bull Trap | BB TRAP Sell | SELL | Synthetic Short (SELL CE + BUY PE) |
| LONG EXIT | BB TRAP Exit Buy | EXIT | Square off LONG |
| SHORT EXIT | BB TRAP Exit Sell | EXIT | Square off SHORT |

### OptionTrade
| Format | Action | Position |
|--------|--------|----------|
| BB TRAP Buy | BUY | Direct Option Buy |
| BB TRAP Sell | SELL | Direct Option Sell |
| BB TRAP Exit Buy | EXIT | Square off BUY |
| BB TRAP Exit Sell | EXIT | Square off SELL |

---

## ✅ Testing

### BankNifty Tests
```bash
node Strategies/BankNifty/test-new-format.js
```
**Coverage:** 11/11 tests passing ✅

### OptionTrade Tests
```bash
node Strategies/OptionTrade/test-signal-formats.js
```
**Coverage:** 10/10 tests passing ✅

---

## 📡 API Endpoints

### BankNifty
```
POST http://localhost:3000/BankNifty/IIFL
```

### OptionTrade
```
POST http://localhost:3000/OptionTrade/IIFL
```

---

## 📝 Notes

1. **BankNifty** uses synthetic positions (combination of CE and PE)
2. **OptionTrade** uses direct option positions
3. Both strategies support backward compatibility
4. Signal parsing is case-insensitive for both
5. Whitespace is handled gracefully in both
6. BankNifty has newer "Bear Trap" and "Bull Trap" formats
7. OptionTrade uses traditional "BB TRAP Buy/Sell" format

---

## 🎯 Recommendations

1. **For BankNifty:** Use the new Bear Trap / Bull Trap format for clarity
2. **For OptionTrade:** Continue using BB TRAP Buy/Sell format
3. **For Exits:** Use direction-specific exits (LONG/SHORT or Buy/Sell) for better tracking
4. **For EOD:** Use "End of Day Exit" or "3PM EXIT" for automatic position closure

---

## 📚 Documentation

- **BankNifty:** See `Strategies/BankNifty/SIGNAL_FORMAT_UPDATE.md`
- **OptionTrade:** See `Strategies/OptionTrade/SIGNAL_FORMATS.md`
- **Quick Reference:** See respective strategy folders

