const axios = require("axios");
require("dotenv").config();

class DhanClient {
  constructor() {
    this.baseURL = "https://api.dhan.co";
    this.accessToken = process.env.ACCESS_TOKEN;
    this.clientId = process.env.CLIENT_ID;

    if (!this.accessToken || !this.clientId) {
      throw new Error("ACCESS_TOKEN and CLIENT_ID must be set in environment variables");
    }

    this.headers = {
      "access-token": this.accessToken,
      "client-id": this.clientId,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Rate limiting: 1 request per 3 seconds
    this.lastRequestTime = 0;
    this.minRequestInterval = 3000; // 3 seconds
  }

  /**
   * Wait for rate limit
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limit: Waiting ${waitTime}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get expiry list
   * @param {number} underlyingScrip - 25 for BankNifty, 13 for NIFTY
   * @param {string} underlyingSeg - "IDX_I" for Index
   */
  async getExpiryList(underlyingScrip, underlyingSeg) {
    await this.waitForRateLimit();

    const url = `${this.baseURL}/v2/optionchain/expirylist`;
    const payload = {
      UnderlyingScrip: underlyingScrip,
      UnderlyingSeg: underlyingSeg
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.headers,
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching expiry list:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get option chain
   * @param {number} underlyingScrip - 25 for BankNifty, 13 for NIFTY
   * @param {string} underlyingSeg - "IDX_I" for Index
   * @param {string} expiry - Expiry date in format "YYYY-MM-DD"
   */
  async getOptionChain(underlyingScrip, underlyingSeg, expiry) {
    await this.waitForRateLimit();

    const url = `${this.baseURL}/v2/optionchain`;
    const payload = {
      UnderlyingScrip: underlyingScrip,
      UnderlyingSeg: underlyingSeg,
      Expiry: expiry
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.headers,
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching option chain:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get strikes with delta closest to 0.50 (one CE, one PE)
   * @param {Object} optionChainData - Option chain data from Dhan API
   * @param {Object} securityIdMap - Map of strike_optionType to security IDs
   * @returns {Object} Object with CE and PE strikes closest to delta 0.50
   */
  getDelta50Strikes(optionChainData, securityIdMap = null) {
    if (!optionChainData?.data?.last_price || !optionChainData?.data?.oc) {
      console.error("❌ Invalid option chain data");
      return null;
    }

    // Round to 2 decimal places helper function
    const round = (num) => {
      if (num === null || num === undefined) return 0;
      return Math.round(num * 100) / 100;
    };

    const allStrikes = Object.keys(optionChainData.data.oc)
      .map((s) => parseFloat(s))
      .sort((a, b) => a - b);

    console.log(`📊 Total strikes available: ${allStrikes.length}`);

    let closestCE = null;
    let closestCEDiff = Infinity;
    let closestPE = null;
    let closestPEDiff = Infinity;

    // Find strikes with delta closest to 0.50 for CE and -0.50 for PE
    allStrikes.forEach((strike) => {
      const strikeKey = strike.toFixed(6);
      const originalData = optionChainData.data.oc[strikeKey];

      if (!originalData?.ce?.greeks?.delta || !originalData?.pe?.greeks?.delta) {
        return; // Skip if greeks data is missing
      }

      const ceDelta = originalData.ce.greeks.delta;
      const peDelta = originalData.pe.greeks.delta;

      // For CE, find closest to 0.50
      const ceDiff = Math.abs(ceDelta - 0.5);
      if (ceDiff < closestCEDiff) {
        closestCEDiff = ceDiff;
        closestCE = {
          strike: strike,
          delta: round(ceDelta),
          top_ask_price: round(originalData.ce.top_ask_price),
        };

        if (securityIdMap) {
          const ceSecurityId = securityIdMap[`${strike}_CE`];
          if (ceSecurityId) {
            closestCE.security_id = ceSecurityId;
          }
        }
      }

      // For PE, find closest to -0.50
      const peDiff = Math.abs(peDelta - -0.5);
      if (peDiff < closestPEDiff) {
        closestPEDiff = peDiff;
        closestPE = {
          strike: strike,
          delta: round(peDelta),
          top_ask_price: round(originalData.pe.top_ask_price),
        };

        if (securityIdMap) {
          const peSecurityId = securityIdMap[`${strike}_PE`];
          if (peSecurityId) {
            closestPE.security_id = peSecurityId;
          }
        }
      }
    });

    console.log(`✅ Found CE strike ${closestCE?.strike} with delta ${closestCE?.delta}`);
    console.log(`✅ Found PE strike ${closestPE?.strike} with delta ${closestPE?.delta}`);

    return {
      last_price: round(optionChainData.data.last_price),
      ce: closestCE,
      pe: closestPE,
    };
  }
}

module.exports = DhanClient;

