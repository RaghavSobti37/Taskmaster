const crypto = require('crypto');
const { encryptSecret, decryptSecret, hashSecret } = require('../utils/credentialEncryption');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateBase32Secret(bytes = 20) {
  let bits = '';
  const buf = crypto.randomBytes(bytes);
  for (const b of buf) {
    bits += b.toString(2).padStart(8, '0');
  }
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(secret) {
  const clean = String(secret || '').toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const c of clean) {
    const val = BASE32.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function verifyTotp(secret, token, window = 1) {
  const step = 30;
  const now = Math.floor(Date.now() / 1000 / step);
  const code = String(token || '').replace(/\s/g, '');
  for (let w = -window; w <= window; w += 1) {
    if (hotp(secret, now + w) === code) return true;
  }
  return false;
}

function generateBackupCodes(count = 8) {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(4).toString('hex');
    codes.push(raw);
    hashes.push(hashSecret(raw));
  }
  return { codes, hashes };
}

function verifyBackupCode(user, code) {
  const hashes = user.mfa?.backupCodesHash || [];
  const idx = hashes.findIndex((h) => h === hashSecret(code));
  if (idx < 0) return false;
  hashes.splice(idx, 1);
  return true;
}

function startMfaEnrollment(user) {
  const secret = generateBase32Secret();
  user.mfa = user.mfa || {};
  user.mfa.pendingSecretEncrypted = encryptSecret(secret);
  return { secret, otpauthUrl: `otpauth://totp/CoreKnot:${encodeURIComponent(user.email)}?secret=${secret}&issuer=CoreKnot` };
}

function confirmMfaEnrollment(user, token) {
  const pending = decryptSecret(user.mfa?.pendingSecretEncrypted);
  if (!pending || !verifyTotp(pending, token)) return null;
  const { codes, hashes } = generateBackupCodes();
  user.mfa.enabled = true;
  user.mfa.secretEncrypted = user.mfa.pendingSecretEncrypted;
  user.mfa.pendingSecretEncrypted = undefined;
  user.mfa.backupCodesHash = hashes;
  return codes;
}

function verifyUserMfa(user, token) {
  const secret = decryptSecret(user.mfa?.secretEncrypted);
  if (secret && verifyTotp(secret, token)) return true;
  return verifyBackupCode(user, token);
}

module.exports = {
  verifyTotp,
  startMfaEnrollment,
  confirmMfaEnrollment,
  verifyUserMfa,
};
