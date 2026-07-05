const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

const getKey = () => {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest();
};

const encryptSecret = (plaintext) => {
  if (plaintext == null || plaintext === '') return plaintext;
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
};

const decryptSecret = (ciphertext) => {
  if (ciphertext == null || ciphertext === '') return ciphertext;
  if (!String(ciphertext).startsWith('enc:')) return ciphertext;
  const key = getKey();
  if (!key) return ciphertext;
  const [, ivB64, tagB64, dataB64] = String(ciphertext).split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
};

const maskSecret = (value, { prefix = 2, suffix = 4 } = {}) => {
  const s = String(value || '');
  if (s.length <= prefix + suffix) return '***';
  return `${s.slice(0, prefix)}***${s.slice(-suffix)}`;
};

const hashSecret = (plaintext) => crypto.createHash('sha256').update(String(plaintext)).digest('hex');

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
  hashSecret,
};
