const axios = require("axios");
require("dotenv").config();

/**
 * Dhan API Client for Option Chain
 */
class DhanClient {
  constructor(accessToken, clientId) {
    this.accessToken = accessToken || process.env.ACCESS_TOKEN;
    this.clientId = clientId || process.env.CLIENT_ID;
    this.baseURL = "https://api.dhan.co/v2";

    if (!this.accessToken || !this.clientId) {
      throw new Error("ACCESS_TOKEN and CLIENT_ID are required. Please set them in .env file or pass them to constructor.");
    }

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
   * Get headers for API requests
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      "access-token": this.accessToken,
      "client-id": this.clientId,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get Option Chain for a specific underlying
   */
  async getOptionChain(underlyingScrip, underlyingSeg, expiry) {
    await this.waitForRateLimit();

    try {
      const response = await axios.post(
        `${this.baseURL}/optionchain`,
        {
          UnderlyingScrip: underlyingScrip,
          UnderlyingSeg: underlyingSeg,
          Expiry: expiry,
        },
        {
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get list of all expiry dates for an underlying
   */
  async getExpiryList(underlyingScrip, underlyingSeg) {
    await this.waitForRateLimit();

    try {
      const response = await axios.post(
        `${this.baseURL}/optionchain/expirylist`,
        {
          UnderlyingScrip: underlyingScrip,
          UnderlyingSeg: underlyingSeg,
        },
        {
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      console.error("API Error Response:", {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
      throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error("No response received:", error.request);
      throw new Error("No response received from API");
    } else {
      console.error("Error:", error.message);
      throw error;
    }
  }

  /**
   * Get strikes with delta closest to 0.50 (one CE, one PE)
   */
  getDelta50Strikes(optionChainData, securityIdMap = null) {
    if (!optionChainData?.data?.last_price || !optionChainData?.data?.oc) {
      return null;
    }

    // Round to 2 decimal places helper function
    const round = (num) => {
      if (num === null || num === undefined) return 0;
      return Math.round(num * 100) / 100;
    };

    // Get available strikes from CSV if securityIdMap is provided
    const availableStrikes = securityIdMap ?
      Object.keys(securityIdMap)
        .map(key => parseFloat(key.split('_')[0]))
        .filter((v, i, a) => a.indexOf(v) === i) // unique values
        .sort((a, b) => a - b)
      : null;

    console.log(`📊 Available strikes in CSV: ${availableStrikes ? availableStrikes.length : 'N/A'}`);
    if (availableStrikes) {
      console.log(`   Range: ${availableStrikes[0]} to ${availableStrikes[availableStrikes.length - 1]}`);
    }

    // Create a map of strike number to original string key
    const strikeKeyMap = {};
    Object.keys(optionChainData.data.oc).forEach(key => {
      const strikeNum = parseFloat(key);
      strikeKeyMap[strikeNum] = key;
    });

    const allStrikes = Object.keys(strikeKeyMap)
      .map((s) => parseFloat(s))
      .sort((a, b) => a - b);

    let closestCE = null;
    let closestCEDiff = Infinity;
    let closestPE = null;
    let closestPEDiff = Infinity;

    // Find strikes with delta closest to 0.50 for CE and -0.50 for PE
    // Only consider strikes that exist in CSV if securityIdMap is provided
    allStrikes.forEach((strike) => {
      // Skip if strike not in CSV
      if (availableStrikes && !availableStrikes.includes(strike)) {
        return;
      }

      // Use the original string key from API response
      const strikeKey = strikeKeyMap[strike];
      const originalData = optionChainData.data.oc[strikeKey];

      // Safety check
      if (!originalData || !originalData.ce || !originalData.pe) {
        console.warn(`⚠️ Missing data for strike ${strike}`);
        return;
      }

      const ceDelta = originalData.ce.greeks?.delta;
      const peDelta = originalData.pe.greeks?.delta;

      // Skip if delta is missing
      if (ceDelta === undefined || peDelta === undefined) {
        return;
      }

      // For CE, find closest to 0.50
      const ceDiff = Math.abs(ceDelta - 0.5);
      if (ceDiff < closestCEDiff) {
        closestCEDiff = ceDiff;

        // Use top_ask_price, fallback to last_price if not available
        const cePrice = originalData.ce.top_ask_price || originalData.ce.last_price || 0;

        closestCE = {
          strike: strike,
          delta: round(ceDelta),
          price: round(cePrice),
        };

        if (securityIdMap) {
          const ceSecurityId = securityIdMap[`${strike}_CE`];
          if (ceSecurityId) {
            closestCE.security_id = ceSecurityId;
          } else {
            console.warn(`⚠️ Security ID not found for CE Strike ${strike}`);
          }
        }
      }

      // For PE, find closest to -0.50
      const peDiff = Math.abs(peDelta - -0.5);
      if (peDiff < closestPEDiff) {
        closestPEDiff = peDiff;

        // Use top_ask_price, fallback to last_price if not available
        const pePrice = originalData.pe.top_ask_price || originalData.pe.last_price || 0;

        closestPE = {
          strike: strike,
          delta: round(peDelta),
          price: round(pePrice),
        };

        if (securityIdMap) {
          const peSecurityId = securityIdMap[`${strike}_PE`];
          if (peSecurityId) {
            closestPE.security_id = peSecurityId;
          }
        }
      }
    });

    return {
      last_price: round(optionChainData.data.last_price),
      ce: closestCE,
      pe: closestPE,
    };
  }
}

module.exports = DhanClient;

