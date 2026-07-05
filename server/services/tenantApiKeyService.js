const crypto = require('crypto');
const TenantApiKey = require('../models/TenantApiKey');
const { hashSecret } = require('../utils/credentialEncryption');

const API_KEY_PREFIX = 'ck_live_';

function generateApiKeyMaterial() {
  const raw = crypto.randomBytes(32).toString('base64url');
  const full = `${API_KEY_PREFIX}${raw}`;
  const prefix = full.slice(0, 16);
  return { full, prefix, hash: hashSecret(full) };
}

async function createTenantApiKey({ tenantId, name, scopes, createdBy }) {
  const { full, prefix, hash } = generateApiKeyMaterial();
  await TenantApiKey.create({
    tenantId,
    name,
    keyPrefix: prefix,
    keyHash: hash,
    scopes: scopes || ['read'],
    createdBy,
  });
  return { key: full, prefix };
}

async function verifyApiKey(bearerToken) {
  if (!bearerToken || !bearerToken.startsWith(API_KEY_PREFIX)) return null;
  const hash = hashSecret(bearerToken);
  const row = await TenantApiKey.findOne({ keyHash: hash, revokedAt: null })
    .setOptions({ bypassTenant: true })
    .select('+keyHash tenantId scopes name');
  if (!row) return null;
  row.lastUsedAt = new Date();
  await row.save();
  return row;
}

module.exports = {
  API_KEY_PREFIX,
  createTenantApiKey,
  verifyApiKey,
};
