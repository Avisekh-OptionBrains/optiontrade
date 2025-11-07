// IIFL Login Utilities - Dynamic login with user credentials
const axios = require('axios');
const crypto = require('crypto');
const { authenticator } = require('otplib');

// Base URL for IIFL API
const BASE_URL = "https://api.iiflcapital.com/v1";

// Helper: chunk a base64 string to 64 char lines for PEM formatting
function chunkString(str, len = 64) {
  const chunks = [];
  for (let i = 0; i < str.length; i += len) chunks.push(str.slice(i, i + len));
  return chunks.join('\n');
}

// Generate RSA keypair
function generateRsaKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  const publicKeyBase64 = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  return {
    publicKeyPem: publicKey,
    publicKeyBase64,
    privateKeyPem: privateKey
  };
}

// Hybrid encryption
function hybridEncrypt(serverPublicKeyBase64, clientPublicKeyBase64, plaintextObj) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const jsonString = JSON.stringify(plaintextObj).replace(/\s+/g, '');
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  let encryptedData = cipher.update(jsonString, "utf8");
  encryptedData = Buffer.concat([encryptedData, cipher.final()]);

  const serverPem = `-----BEGIN PUBLIC KEY-----\n${chunkString(serverPublicKeyBase64)}\n-----END PUBLIC KEY-----`;
  const encryptedAesKey = crypto.publicEncrypt({
    key: serverPem,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, aesKey);

  const clientPubKeyBytes = Buffer.from(clientPublicKeyBase64, 'utf8');
  const totalSize = 4 + clientPubKeyBytes.length + 4 + iv.length + 4 + encryptedAesKey.length + encryptedData.length;
  const packageBuffer = Buffer.alloc(totalSize);
  let offset = 0;

  packageBuffer.writeInt32BE(clientPubKeyBytes.length, offset);
  offset += 4;
  clientPubKeyBytes.copy(packageBuffer, offset);
  offset += clientPubKeyBytes.length;

  packageBuffer.writeInt32BE(iv.length, offset);
  offset += 4;
  iv.copy(packageBuffer, offset);
  offset += iv.length;

  packageBuffer.writeInt32BE(encryptedAesKey.length, offset);
  offset += 4;
  encryptedAesKey.copy(packageBuffer, offset);
  offset += encryptedAesKey.length;

  encryptedData.copy(packageBuffer, offset);

  return packageBuffer.toString('base64');
}

// Get server public key
async function getEncKey(clientPublicKeyBase64) {
  const payload = { ceData: clientPublicKeyBase64 };
  const response = await axios.post(`${BASE_URL}/get/enckey`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 20000
  });

  let serverPubKey = response.data?.cPubKey || response.data?.result?.[0]?.seData;
  if (!serverPubKey) throw new Error("No server public key found");

  const testPem = `-----BEGIN PUBLIC KEY-----\n${chunkString(serverPubKey)}\n-----END PUBLIC KEY-----`;
  crypto.createPublicKey(testPem);

  return serverPubKey;
}

// Validate password
async function validatePassword(serverPubKeyBase64, clientKeypair, clientId, password) {
  const payload = { clientId: clientId, password: password };
  const encryptedPayload = hybridEncrypt(serverPubKeyBase64, clientKeypair.publicKeyBase64, payload);
  const requestBody = { cEncData: encryptedPayload };
  const response = await axios.post(`${BASE_URL}/validatepassword`, requestBody, {
    headers: { "Content-Type": "application/json" },
    timeout: 20000
  });

  let token = response.data?.result?.token || response.data?.result?.[0]?.token || response.data?.token;
  if (!token) throw new Error("No authentication token received from server");
  return token;
}

// Validate TOTP
async function validateTotp(token, clientId, totpSecret, appKey) {
  const totp = authenticator.generate(totpSecret);
  const payload = { clientId: clientId, totp, appKey: appKey };
  const response = await axios.post(`${BASE_URL}/validatetotp`, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 15000
  });

  let authCode = response.data?.result?.authCode || response.data?.result?.[0]?.authCode || response.data?.authCode;
  if (!authCode) throw new Error("No authCode received from TOTP validation");
  return authCode;
}

// Get user session
async function getUserSession(authCode, clientId, appSecret) {
  const checksumInput = clientId + authCode + appSecret;
  const checksum = crypto.createHash('sha256').update(checksumInput).digest('hex');
  const response = await axios.post(`${BASE_URL}/getusersession`, { checkSum: checksum }, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000
  });

  let accessToken = response.data?.result?.userSession || response.data?.result?.[0]?.userSession || response.data?.userSession || response.data?.accessToken;
  if (!accessToken) throw new Error("No access token received");
  return accessToken;
}

// Main login flow with user credentials
async function loginWithCredentials(userCredentials) {
  const { userID, password, appKey, appSecret, totpSecret } = userCredentials;
  
  try {
    console.log(`🔐 Starting IIFL login for client: ${userID}`);
    
    const clientKeypair = generateRsaKeypair();
    console.log(`🔑 Generated RSA keypair`);
    
    const serverPubKeyBase64 = await getEncKey(clientKeypair.publicKeyBase64);
    console.log(`🔑 Retrieved server public key`);
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // wait for key association
    console.log(`⏳ Key association wait completed`);
    
    const token = await validatePassword(serverPubKeyBase64, clientKeypair, userID, password);
    console.log(`✅ Password validated, token received`);
    
    const authCode = await validateTotp(token, userID, totpSecret, appKey);
    console.log(`✅ TOTP validated, authCode received`);
    
    const accessToken = await getUserSession(authCode, userID, appSecret);
    console.log(`✅ Access token generated successfully`);

    return { 
      accessToken, 
      success: true,
      message: "Login successful"
    };
  } catch (err) {
    console.error(`❌ IIFL login failed for ${userID}:`, err.message);
    return { 
      success: false, 
      error: err.message,
      userID: userID
    };
  }
}

module.exports = {
  loginWithCredentials,
  hybridEncrypt,
  generateRsaKeypair,
  getEncKey,
  validatePassword,
  validateTotp,
  getUserSession
};
