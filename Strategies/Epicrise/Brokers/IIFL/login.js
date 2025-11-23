// login_fixed.js - Cleaned up version (debugging removed)
const axios = require('axios');
const crypto = require('crypto');
const { authenticator } = require('otplib');

// ================== CONFIG ==================
const BASE_URL = "https://api.iiflcapital.com/v1";
const CLIENT_ID = "28748327";
const PASSWORD = "Avi@5028";
const APP_SECRET = "C3Pxm1Pcu1YNcDAduKc77copxLVL6o1w9dr1Qjo4CW906rzh5DgT6eJsHrWhZVPiHBVo1Aq29AwaqnaqBQDGGLzVEV1zdKY4YBT6";
const TOTP_SECRET_BASE32 = "ESREZEREDLWZUSRUMAYLXANFYLLHANZH";
const APP_KEY = "vYvFiDZyqNaOAIu";

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
async function validatePassword(serverPubKeyBase64, clientKeypair) {
  const payload = { clientId: CLIENT_ID, password: PASSWORD };
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
async function validateTotp(token) {
  const totp = authenticator.generate(TOTP_SECRET_BASE32);
  const payload = { clientId: CLIENT_ID, totp, appKey: APP_KEY };
  const response = await axios.post(`${BASE_URL}/validatetotp`, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 15000
  });

  let authCode = response.data?.result?.authCode || response.data?.result?.[0]?.authCode || response.data?.authCode;
  if (!authCode) throw new Error("No authCode received from TOTP validation");
  return authCode;
}

// Skip SMS and use TOTP
async function skipSmsAndUseTotp(token) {
  return await validateTotp(token);
}

// Get user session
async function getUserSession(authCode) {
  const checksumInput = CLIENT_ID + authCode + APP_SECRET;
  const checksum = crypto.createHash('sha256').update(checksumInput).digest('hex');
  const response = await axios.post(`${BASE_URL}/getusersession`, { checkSum: checksum }, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000
  });

  let accessToken = response.data?.result?.userSession || response.data?.result?.[0]?.userSession || response.data?.userSession || response.data?.accessToken;
  if (!accessToken) throw new Error("No access token received");
  return accessToken;
}

// Main login flow
async function login() {
  try {
    const clientKeypair = generateRsaKeypair();
    const serverPubKeyBase64 = await getEncKey(clientKeypair.publicKeyBase64);
    await new Promise(resolve => setTimeout(resolve, 10000)); // wait for key association
    const token = await validatePassword(serverPubKeyBase64, clientKeypair);
    const authCode = await skipSmsAndUseTotp(token);
    const accessToken = await getUserSession(authCode);

    console.log("\n=== LOGIN SUCCESSFUL ===");
    console.log("Access Token:", accessToken);
    return { accessToken, success: true };
  } catch (err) {
    console.error("\n=== LOGIN FAILED ===", err.message);
    return { success: false, error: err.message };
  }
}

// Export
module.exports = { login, hybridEncrypt, generateRsaKeypair };

// Execute if run directly
if (require.main === module) {
  login().then(result => {
    if (!result.success) console.log("Login failed:", result.error);
  });
}
