# Bank Nifty BB TRAP Signal Quick Reference

## 📥 Entry Signals

### NEW FORMAT

| Signal Type | Format | Example |
|-------------|--------|---------|
| **BUY (Bear Trap)** | `<TICKER> \| Bear Trap \| Entry at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BANKNIFTY \| Bear Trap \| Entry at 51590.5 \| SL: 51550.5 \| Target: 51650.5` |
| **SELL (Bull Trap)** | `<TICKER> \| Bull Trap \| Entry at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BANKNIFTY \| Bull Trap \| Entry at 51590.5 \| SL: 51630.5 \| Target: 51510.5` |

### OLD FORMAT (Still Supported)

| Signal Type | Format | Example |
|-------------|--------|---------|
| **BUY** | `BB TRAP Buy <TICKER> at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BB TRAP Buy BANKNIFTY at 51590.5 \| SL: 51550.5 \| Target: 51650.5` |
| **SELL** | `BB TRAP Sell <TICKER> at <ENTRY> \| SL: <SL> \| Target: <TARGET>` | `BB TRAP Sell BANKNIFTY at 51590.5 \| SL: 51630.5 \| Target: 51510.5` |

---

## 📤 Exit Signals

### NEW FORMAT

| Exit Type | Reason | Format | Example |
|-----------|--------|--------|---------|
| **LONG EXIT** | SL Hit | `BB TRAP LONG EXIT (SL HIT) <TICKER> at <PRICE>` | `BB TRAP LONG EXIT (SL HIT) BANKNIFTY at 51550.5` |
| **LONG EXIT** | Target Hit | `BB TRAP LONG EXIT (TARGET HIT) <TICKER> at <PRICE>` | `BB TRAP LONG EXIT (TARGET HIT) BANKNIFTY at 51650.5` |
| **LONG EXIT** | 3PM Exit | `BB TRAP LONG EXIT (3PM EXIT) <TICKER> at <PRICE>` | `BB TRAP LONG EXIT (3PM EXIT) BANKNIFTY at 51590.5` |
| **SHORT EXIT** | SL Hit | `BB TRAP SHORT EXIT (SL HIT) <TICKER> at <PRICE>` | `BB TRAP SHORT EXIT (SL HIT) BANKNIFTY at 51630.5` |
| **SHORT EXIT** | Target Hit | `BB TRAP SHORT EXIT (TARGET HIT) <TICKER> at <PRICE>` | `BB TRAP SHORT EXIT (TARGET HIT) BANKNIFTY at 51510.5` |
| **SHORT EXIT** | 3PM Exit | `BB TRAP SHORT EXIT (3PM EXIT) <TICKER> at <PRICE>` | `BB TRAP SHORT EXIT (3PM EXIT) BANKNIFTY at 51590.5` |

### OLD FORMAT (Still Supported)

| Exit Type | Format | Example |
|-----------|--------|---------|
| **With Direction** | `BB TRAP Exit <Buy\|Sell> <TICKER> at <PRICE> \| <Reason>` | `BB TRAP Exit Buy BANKNIFTY at 51550.5 \| SL Hit` |
| **Without Direction** | `BB TRAP Exit <TICKER> at <PRICE> \| <Reason>` | `BB TRAP Exit BANKNIFTY at 51590.5 \| Intraday Exit` |

---

## 🎯 Signal Interpretation

### Entry Signals

| Signal | Direction | Position Type | CE Action | PE Action |
|--------|-----------|---------------|-----------|-----------|
| Bear Trap | BUY | Synthetic Long | BUY | SELL |
| Bull Trap | SELL | Synthetic Short | SELL | BUY |

### Exit Signals

| Exit Signal | Closes Position | Action |
|-------------|-----------------|--------|
| LONG EXIT | BUY (Bear Trap) | Square off CE & PE |
| SHORT EXIT | SELL (Bull Trap) | Square off CE & PE |

---

## 🔑 Keywords Recognized

The system accepts signals containing any of these keywords:
- `BB TRAP`
- `Bear Trap`
- `Bull Trap`
- `LONG EXIT`
- `SHORT EXIT`

---

## ✅ Testing

Run comprehensive tests:
```bash
node Strategies/BankNifty/test-new-format.js
```

**Test Coverage:** 11/11 tests passing ✅

---

## 📡 API Endpoint

```
POST http://localhost:3000/BankNifty/IIFL
Content-Type: application/json

{
  "messageText": "<SIGNAL_STRING>"
}
```

---

## 💡 Tips

1. **Case Insensitive:** All parsing is case-insensitive
2. **Whitespace Tolerant:** Extra spaces are handled gracefully
3. **Backward Compatible:** Old format signals still work
4. **Exit Direction:** New format explicitly specifies LONG/SHORT for clarity
5. **Exit Reasons:** Three types: SL HIT, TARGET HIT, 3PM EXIT

