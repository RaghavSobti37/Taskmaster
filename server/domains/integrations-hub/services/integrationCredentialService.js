const { encryptSecret, decryptSecret } = require('../../../utils/credentialEncryption');

function packCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') return null;
  return encryptSecret(JSON.stringify(credentials));
}

function unpackCredentials(credentialsEncrypted) {
  if (!credentialsEncrypted) return null;
  const raw = decryptSecret(credentialsEncrypted);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { legacy: raw };
  }
}

module.exports = {
  packCredentials,
  unpackCredentials,
};
