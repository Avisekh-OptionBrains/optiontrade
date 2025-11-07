// networkInfo.js - Centralized network information utility
// Based on datad/src/lib/networkInfo.ts implementation
const { networkInterfaces } = require('os');
const https = require('https');
require('dotenv').config();

// Pre-initialized network variables (set once at startup)
let CLIENT_LOCAL_IP;
let CLIENT_PUBLIC_IP;
let CLIENT_MAC_ADDRESS;

// Flag to track initialization status
let isInitialized = false;
let initializationPromise = null;

/**
 * Fetch public IP from external service
 */
function fetchPublicIp() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Public IP fetch timeout'));
    }, 10000); // 10 second timeout

    https
      .get("https://api.ipify.org?format=json", (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          clearTimeout(timeout);
          try {
            const ipInfo = JSON.parse(data);
            resolve(ipInfo.ip);
          } catch (error) {
            reject(new Error('Failed to parse IP response'));
          }
        });
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

/**
 * Get local IP and MAC from network interfaces
 */
function getLocalNetworkInfo() {
  const interfaces = networkInterfaces();
  let localIP = '192.168.1.100'; // Default fallback
  let macAddress = '00:00:00:00:00:00'; // Default fallback

  // Find first non-internal IPv4 interface
  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];
    if (networkInterface) {
      for (const net of networkInterface) {
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
          if (net.mac && net.mac !== '00:00:00:00:00:00') {
            macAddress = net.mac;
          }
          break;
        }
      }
      if (localIP !== '192.168.1.100') break;
    }
  }

  return { localIP, macAddress };
}

/**
 * Initialize network details (called once at startup)
 */
async function initializeNetworkDetails() {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('🌐 Initializing network information...');
      
      // Get local network info synchronously
      const { localIP, macAddress } = getLocalNetworkInfo();
      
      // Try to fetch public IP, with fallback
      let publicIP;
      try {
        publicIP = await fetchPublicIp();
        console.log('✅ Public IP fetched successfully:', publicIP);
      } catch (error) {
        console.warn('⚠️ Failed to fetch public IP, using fallback:', error.message);
        publicIP = '203.0.113.1'; // RFC 5737 documentation IP
      }

      // Set global variables with environment variable overrides
      CLIENT_LOCAL_IP = process.env.CLIENT_LOCAL_IP || localIP;
      CLIENT_PUBLIC_IP = process.env.CLIENT_PUBLIC_IP || publicIP;
      CLIENT_MAC_ADDRESS = process.env.CLIENT_MAC_ADDRESS || macAddress;

      console.log('✅ Network information initialized:');
      console.log(`   Local IP: ${CLIENT_LOCAL_IP}`);
      console.log(`   Public IP: ${CLIENT_PUBLIC_IP}`);
      console.log(`   MAC Address: ${CLIENT_MAC_ADDRESS}`);

      isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize network information:', error);
      // Set fallback values
      CLIENT_LOCAL_IP = process.env.CLIENT_LOCAL_IP || '192.168.1.100';
      CLIENT_PUBLIC_IP = process.env.CLIENT_PUBLIC_IP || '203.0.113.1';
      CLIENT_MAC_ADDRESS = process.env.CLIENT_MAC_ADDRESS || '00:00:00:00:00:00';
      isInitialized = true;
    }
  })();

  return initializationPromise;
}

/**
 * Get broker headers with pre-initialized network information (no delays)
 * Compatible with existing broker implementations
 */
function getBrokerHeaders() {
  if (!isInitialized) {
    console.warn('⚠️ Network info not initialized, using fallback values');
    return {
      'X-ClientLocalIP': '192.168.1.100',
      'X-ClientPublicIP': '203.0.113.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'ClientLocalIp': '192.168.1.100',
      'ClientPublicIp': '203.0.113.1',
      'MacAddress': '00:00:00:00:00:00'
    };
  }

  return {
    'X-ClientLocalIP': CLIENT_LOCAL_IP,
    'X-ClientPublicIP': CLIENT_PUBLIC_IP,
    'X-MACAddress': CLIENT_MAC_ADDRESS,
    'ClientLocalIp': CLIENT_LOCAL_IP,
    'ClientPublicIp': CLIENT_PUBLIC_IP,
    'MacAddress': CLIENT_MAC_ADDRESS
  };
}

/**
 * Get network credentials in the format expected by existing broker code
 * This maintains compatibility with existing cred.js usage
 */
async function getNetworkCredentials() {
  // Ensure initialization is complete
  await initializeNetworkDetails();
  
  return {
    publicIp: CLIENT_PUBLIC_IP,
    macAddress: CLIENT_MAC_ADDRESS,
    localIp: CLIENT_LOCAL_IP
  };
}

/**
 * Legacy compatibility function - matches existing cred.js export pattern
 */
async function getCredentials() {
  return getNetworkCredentials();
}

// Initialize immediately when module is imported
initializeNetworkDetails().catch(console.error);

// Export functions and values
module.exports = {
  // Main functions
  getNetworkCredentials,
  getBrokerHeaders,
  initializeNetworkDetails,
  
  // Legacy compatibility
  getCredentials,
  
  // Direct access to values (for advanced usage)
  get CLIENT_LOCAL_IP() { return CLIENT_LOCAL_IP; },
  get CLIENT_PUBLIC_IP() { return CLIENT_PUBLIC_IP; },
  get CLIENT_MAC_ADDRESS() { return CLIENT_MAC_ADDRESS; },
  
  // Utility functions
  get isInitialized() { return isInitialized; }
};
