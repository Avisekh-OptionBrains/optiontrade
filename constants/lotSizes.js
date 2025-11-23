/**
 * Lot Size Constants for Different Instruments
 * 
 * These are the standard lot sizes defined by NSE.
 * Quantity = Number of Lots × Lot Size
 * 
 * Example:
 * - User subscribes with lotSize = 2
 * - For NIFTY: quantity = 2 × 75 = 150
 * - For BankNifty: quantity = 2 × 35 = 70
 */

const LOT_SIZES = {
  // Index Options
  NIFTY: 75,           // 1 lot = 75 quantity
  BANKNIFTY: 35,       // 1 lot = 35 quantity (updated from 25 to 35 as per latest NSE)
  FINNIFTY: 40,        // 1 lot = 40 quantity
  MIDCPNIFTY: 75,      // 1 lot = 75 quantity
  
  // Stock Futures (examples - these vary by stock)
  RELIANCE: 250,
  TCS: 150,
  INFY: 300,
  HDFCBANK: 550,
  ICICIBANK: 1375,
};

/**
 * Get lot size for a symbol
 * @param {string} symbol - Trading symbol (e.g., "NIFTY", "NIFTY1!", "BANKNIFTY")
 * @returns {number} - Lot size (quantity per lot)
 */
function getLotSize(symbol) {
  // Normalize symbol (remove "1!" suffix if present)
  const normalizedSymbol = symbol.replace(/1!$/, '').toUpperCase();
  
  // Check if symbol exists in LOT_SIZES
  if (LOT_SIZES[normalizedSymbol]) {
    return LOT_SIZES[normalizedSymbol];
  }
  
  // Default fallback
  console.warn(`⚠️ Lot size not found for ${symbol}, using default: 1`);
  return 1;
}

/**
 * Calculate quantity from number of lots
 * @param {string} symbol - Trading symbol
 * @param {number} numberOfLots - Number of lots to trade
 * @returns {number} - Total quantity
 */
function calculateQuantity(symbol, numberOfLots) {
  console.log(`🔍 calculateQuantity called with:`, { symbol, numberOfLots, symbolType: typeof symbol, lotsType: typeof numberOfLots });

  if (!symbol || !numberOfLots) {
    console.error(`❌ Invalid parameters: symbol=${symbol}, numberOfLots=${numberOfLots}`);
    return null;
  }

  const lotSize = getLotSize(symbol);
  const quantity = numberOfLots * lotSize;

  console.log(`📊 Quantity Calculation: ${numberOfLots} lots × ${lotSize} = ${quantity} qty`);
  return quantity;
}

module.exports = {
  LOT_SIZES,
  getLotSize,
  calculateQuantity
};

