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

    const allStrikes = Object.keys(optionChainData.data.oc)
      .map((s) => parseFloat(s))
      .sort((a, b) => a - b);

    let closestCE = null;
    let closestCEDiff = Infinity;
    let closestPE = null;
    let closestPEDiff = Infinity;

    // Find strikes with delta closest to 0.50 for CE and -0.50 for PE
    allStrikes.forEach((strike) => {
      const strikeKey = strike.toFixed(6);
      const originalData = optionChainData.data.oc[strikeKey];

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

    return {
      last_price: round(optionChainData.data.last_price),
      ce: closestCE,
      pe: closestPE,
    };
  }
}

module.exports = DhanClient;

