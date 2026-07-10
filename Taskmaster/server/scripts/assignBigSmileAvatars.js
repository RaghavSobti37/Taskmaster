/**
 * One-time migration: assign every user a random DiceBear "Big Smile" avatar by gender.
 * URLs match client/src/constants/avatarCatalog.js ("Big Smile" category).
 *
 * Gender → avatar pool (50 tiles, seeds bigsmile-0 … bigsmile-49):
 *   male   → random index 0–24
 *   female → random index 25–49
 *   other / missing / invalid → random index 0–49 (full pool)
 *
 * Idempotency (no --force): same user._id always gets the same index (hash); skips users
 * whose avatar is already a big-smile DiceBear URL.
 * --force: new random index per user; overwrites all avatars including existing big-smile.
 *
 * LOCAL (from server/):
 *   node scripts/assignBigSmileAvatars.js              # dry-run (MONGODB_URI)
 *   node scripts/assignBigSmileAvatars.js --dry-run
 *   node scripts/assignBigSmileAvatars.js --apply
 *   node scripts/assignBigSmileAvatars.js --apply --force
 *
 * PRODUCTION — backup DB first, then:
 *   node scripts/assignBigSmileAvatars.js --prod --dry-run
 *   ASSIGN_BIG_SMILE_CONFIRM=1 node scripts/assignBigSmileAvatars.js --prod --apply
 *   ASSIGN_BIG_SMILE_CONFIRM=1 node scripts/assignBigSmileAvatars.js --prod --apply --force
 *
 * Windows PowerShell prod apply:
 *   $env:ASSIGN_BIG_SMILE_CONFIRM='1'; node scripts/assignBigSmileAvatars.js --prod --apply
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getDbNameFromUri, maskMongoUri } = require('../config/database');

const BYPASS = { bypassTenant: true };
const STYLE = 'big-smile';
const PREFIX = 'bigsmile';
const COUNT = 50;

const argv = process.argv.slice(2);
const useProd = argv.includes('--prod');
const apply = argv.includes('--apply');
const dryRun = argv.includes('--dry-run') || !apply;
const force = argv.includes('--force');

const BIG_SMILE_POOL = Array.from({ length: COUNT }, (_, i) =>
  `https://api.dicebear.com/9.x/${STYLE}/svg?seed=${encodeURIComponent(`${PREFIX}-${i}`)}`
);

const BIG_SMILE_RE = /api\.dicebear\.com\/9\.x\/big-smile\/svg/i;

function normalizeGender(raw) {
  const g = String(raw || '').toLowerCase().trim();
  if (g === 'female') return 'female';
  if (g === 'male') return 'male';
  return 'other';
}

/** Inclusive index bounds for random / deterministic pick. */
function indexRangeForGender(genderBucket) {
  if (genderBucket === 'female') return { min: 25, max: 49 };
  if (genderBucket === 'male') return { min: 0, max: 24 };
  return { min: 0, max: 49 };
}

function isBigSmileUrl(url) {
  return typeof url === 'string' && BIG_SMILE_RE.test(url);
}

function pickIndex(userId, genderBucket, useForce) {
  const { min, max } = indexRangeForGender(genderBucket);
  const span = max - min + 1;
  if (useForce) {
    return min + Math.floor(Math.random() * span);
  }
  const hash = crypto.createHash('sha256').update(String(userId)).digest();
  return min + (hash.readUInt32BE(0) % span);
}

function avatarForUser(user, useForce) {
  const bucket = normalizeGender(user.gender);
  const idx = pickIndex(user._id, bucket, useForce);
  return { url: BIG_SMILE_POOL[idx], bucket, idx };
}

async function main() {
  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || '').trim()
    : (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();

  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
    process.exit(1);
  }

  if (apply && useProd && process.env.ASSIGN_BIG_SMILE_CONFIRM !== '1') {
    console.error('Production apply blocked. Set ASSIGN_BIG_SMILE_CONFIRM=1 and re-run.');
    process.exit(1);
  }

  const dbName = getDbNameFromUri(uri);
  console.log(`Target: ${useProd ? 'PRODUCTION' : 'LOCAL'} (${maskMongoUri(uri)} / ${dbName || 'unknown'})`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}${force ? ' (force overwrite)' : ''}\n`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });

  const users = await User.find({})
    .setOptions(BYPASS)
    .select('_id name email gender avatar')
    .lean();

  const counts = { male: 0, female: 0, other: 0 };
  let wouldUpdate = 0;
  let skipped = 0;
  let updated = 0;

  for (const user of users) {
    const bucket = normalizeGender(user.gender);
    counts[bucket] += 1;

    if (!force && isBigSmileUrl(user.avatar)) {
      skipped += 1;
      continue;
    }

    const { url, idx } = avatarForUser(user, force);
    wouldUpdate += 1;

    if (!dryRun) {
      await User.updateOne({ _id: user._id }, { $set: { avatar: url } }).setOptions(BYPASS);
      updated += 1;
    }

    if (dryRun && wouldUpdate <= 5) {
      console.log(
        `WOULD SET: ${user.email} (${user.name}) gender=${user.gender || '(default)'} → bigsmile-${idx}`
      );
    }
  }

  console.log('\nUsers by gender bucket:', counts);
  console.log(`Total users: ${users.length}`);
  if (!force) {
    console.log(`Skipped (already big-smile): ${skipped}`);
  }
  console.log(
    dryRun
      ? `Would update: ${wouldUpdate} user(s). Re-run with --apply${useProd ? ' --prod' : ''} to commit.`
      : `Updated: ${updated} user(s).`
  );

  if (dryRun && wouldUpdate > 5) {
    console.log(`(Sample: first 5 of ${wouldUpdate} would-change users shown above.)`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
