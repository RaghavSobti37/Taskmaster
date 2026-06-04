/**
 * Backfill passwordChangedAt for accounts that already have a password hash
 * but were created before passwordChangedAt was tracked (register, profile, admin).
 *
 * Usage:
 *   node scripts/backfillPasswordChangedAt.js           # dry-run
 *   node scripts/backfillPasswordChangedAt.js --apply   # write to DB
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { resolveMongoUri, getDbNameFromUri, maskMongoUri } = require('../config/database');

const apply = process.argv.includes('--apply');

async function main() {
  const { dbUri } = resolveMongoUri();
  if (!dbUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  console.log(`Target: ${maskMongoUri(dbUri)} / ${getDbNameFromUri(dbUri) || 'unknown'}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 30000 });

  const users = await User.find({
    password: { $exists: true, $nin: [null, ''] },
    $or: [{ passwordChangedAt: { $exists: false } }, { passwordChangedAt: null }],
  })
    .select('email name googleId passwordChangedAt createdAt updatedAt')
    .setOptions({ bypassTenant: true });

  console.log(`Found ${users.length} user(s) with password but no passwordChangedAt\n`);

  for (const user of users) {
    const stamp = user.updatedAt || user.createdAt || new Date();
    console.log(
      `${apply ? 'UPDATE' : 'WOULD UPDATE'}: ${user.email} (${user.name})`
      + ` googleId=${Boolean(user.googleId)} → passwordChangedAt=${stamp.toISOString()}`
    );
    if (apply) {
      user.passwordChangedAt = stamp;
      // eslint-disable-next-line no-await-in-loop
      await user.save();
    }
  }

  await mongoose.disconnect();
  console.log(`\nDone.${apply ? '' : ' Re-run with --apply to persist.'}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
