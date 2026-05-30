const crypto = require('crypto');
const logger = require('../utils/logger');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY) {
  logger.warn('encryption', 'ENCRYPTION_KEY is not set — OAuth/API tokens cannot be decrypted reliably across restarts. Set a 64-char hex key in server/.env');
}

function getKeyBuffer() {
  if (!ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string in server/.env');
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBuffer(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + encrypted.toString('hex') + ':' + authTag.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    if (textParts.length !== 3) return text; // Probably not encrypted
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.shift(), 'hex');
    const authTag = Buffer.from(textParts.shift(), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKeyBuffer(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    logger.error('encryption', 'Decryption ', { error: error.message || error });
    return null;
  }
}

module.exports = { encrypt, decrypt };
