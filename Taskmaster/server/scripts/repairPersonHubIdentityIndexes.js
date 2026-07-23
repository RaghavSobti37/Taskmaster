/**
 * Repair PersonHubView identity indexes so missing email/phone values do not
 * collide under tenant-scoped unique indexes.
 */
const fs = require('fs');
const path = require('path');

for (const envPath of [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../../server/.env'),
]) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const mongoose = require('mongoose');
const PersonHubView = require('../models/PersonHubView');

async function ensurePersonHubIdentityIndexes() {
  const col = PersonHubView.collection;
  await col.updateMany({ email: null }, { $unset: { email: '' } });
  await col.updateMany({ phone: null }, { $unset: { phone: '' } });

  const desired = {
    tenantId_1_email_1: {
      key: { tenantId: 1, email: 1 },
      unique: true,
      partialFilterExpression: { email: { $exists: true, $type: 'string', $gt: '' } },
      name: 'tenantId_1_email_1',
    },
    tenantId_1_phone_1: {
      key: { tenantId: 1, phone: 1 },
      unique: true,
      partialFilterExpression: { phone: { $exists: true, $type: 'string', $gt: '' } },
      name: 'tenantId_1_phone_1',
    },
  };

  const indexes = await col.indexes();
  for (const [name, spec] of Object.entries(desired)) {
    const current = indexes.find((idx) => idx.name === name);
    const hasPartial = Boolean(current?.partialFilterExpression);
    if (current && !hasPartial) {
      await col.dropIndex(name);
    }
    if (!current || !hasPartial) {
      await col.createIndex(spec.key, spec);
    }
  }
}

async function main() {
  const useProd = process.argv.includes('--prod');
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');
  await mongoose.connect(uri);
  await ensurePersonHubIdentityIndexes();
  console.log('[repairPersonHubIdentityIndexes] done');
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  ensurePersonHubIdentityIndexes,
};
