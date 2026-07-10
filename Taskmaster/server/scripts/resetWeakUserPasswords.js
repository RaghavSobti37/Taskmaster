/**
 * Reset users whose current password matches a known weak value to the secure default.
 *
 * Usage:
 *   node scripts/resetWeakUserPasswords.js                    # dry-run (local MONGODB_URI)
 *   node scripts/resetWeakUserPasswords.js --apply            # apply local
 *   node scripts/resetWeakUserPasswords.js --accounts=a@x.com,b@y.com --apply
 *   node scripts/resetWeakUserPasswords.js --prod             # dry-run production
 *   node scripts/resetWeakUserPasswords.js --prod --apply     # apply production (requires confirm)
 *
 * Production apply requires: RESET_WEAK_PASSWORDS_CONFIRM=1
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { WEAK_PASSWORDS } = require('../utils/passwordValidation');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
const { getDbNameFromUri, maskMongoUri } = require('../config/database');

const apply = process.argv.includes('--apply');
const useProd = process.argv.includes('--prod');

const accountsArg = process.argv.find((arg) => arg.startsWith('--accounts='));
const forceAccountEmails = accountsArg
  ? accountsArg.slice('--accounts='.length).split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

const EXTRA_WEAK = ['test', 'demo', 'pass', 'pass123', 'changeme', 'welcome1'];

async function resetUserPassword(user, newPassword, updatedEmails) {
  user.password = newPassword;
  user.mustChangePassword = true;
  await user.save();
  updatedEmails.push(user.email);
}

async function main() {
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || '').trim()
    : (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();

  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
    process.exit(1);
  }

  if (apply && useProd && process.env.RESET_WEAK_PASSWORDS_CONFIRM !== '1') {
    console.error('Production apply blocked. Set RESET_WEAK_PASSWORDS_CONFIRM=1 and re-run.');
    process.exit(1);
  }

  const newPassword = getDefaultSeedPassword();
  const candidates = [...new Set([...WEAK_PASSWORDS, ...EXTRA_WEAK])];
  const dbName = getDbNameFromUri(uri);

  console.log(`Target: ${useProd ? 'PRODUCTION' : 'LOCAL'} (${maskMongoUri(uri)} / ${dbName || 'unknown'})`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`New password: [hidden — ${newPassword.length} chars from DEFAULT_SEED_PASSWORD / shared default]\n`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });

  let matched = 0;
  const updatedEmails = [];

  if (forceAccountEmails.length > 0) {
    console.log(`Force sync for ${forceAccountEmails.length} account(s)\n`);
    for (const email of forceAccountEmails) {
      // eslint-disable-next-line no-await-in-loop
      const user = await User.findOne({ email }).select('+password name email');
      if (!user) {
        console.log(`SKIP (not found): ${email}`);
        continue;
      }
      if (!user.password) {
        console.log(`SKIP (no password / OAuth-only): ${email}`);
        continue;
      }
      matched += 1;
      console.log(`${apply ? 'UPDATING' : 'WOULD UPDATE'}: ${user.email} (${user.name}) — force sync to default password`);
      if (apply) {
        // eslint-disable-next-line no-await-in-loop
        await resetUserPassword(user, newPassword, updatedEmails);
      }
    }
  } else {
  const users = await User.find().select('+password name email').lean(false);

  for (const user of users) {
    if (!user.password) continue;
    let matchedWeak = null;
    for (const weak of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await user.comparePassword(weak)) {
        matchedWeak = weak;
        break;
      }
    }
    if (!matchedWeak) continue;

    matched += 1;
    console.log(`${apply ? 'UPDATING' : 'WOULD UPDATE'}: ${user.email} (${user.name}) — was: ${matchedWeak}`);
    if (apply) {
      // eslint-disable-next-line no-await-in-loop
      await resetUserPassword(user, newPassword, updatedEmails);
    }
  }
  }

  console.log(
    apply
      ? `\nDone. Reset ${matched} user(s).`
      : `\nDry run — ${matched} user(s) would be reset. Re-run with --apply${useProd ? ' --prod' : ''} to commit.`
  );

  if (apply && updatedEmails.length > 0) {
    console.log('Updated accounts:', updatedEmails.join(', '));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
