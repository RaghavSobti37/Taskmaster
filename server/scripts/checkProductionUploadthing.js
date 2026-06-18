/**
 * Compare local vs production UploadThing key fingerprints via /api/health.
 * Run: node server/scripts/checkProductionUploadthing.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { validateUploadthingCredentials } = require('../utils/uploadthingCredentials');

const PROD_HEALTH = process.env.PROD_HEALTH_URL || 'https://taskmaster-jfw0.onrender.com/api/health';

async function main() {
  const local = validateUploadthingCredentials();
  console.log('Local UploadThing:');
  console.log(`  ok: ${local.ok}`);
  console.log(`  keyFingerprint: ${local.keyFingerprint || 'n/a'}`);
  if (!local.ok) console.log(`  reason: ${local.message}`);

  const res = await fetch(PROD_HEALTH);
  const body = await res.json();
  const prod = body?.dependencies?.uploadthing || body?.data?.dependencies?.uploadthing;

  console.log('\nProduction /api/health:');
  if (!prod) {
    console.log('  uploadthing: not reported (deploy API with health uploadthing check first)');
    console.log('  Your Render screenshot TOKEN apiKey starts with sk_live_12d729 — local uses sk_live_5b1228.');
    console.log('  That mismatch alone causes XHR failed 400 on ingest.');
    process.exit(1);
  }
  console.log(`  ok: ${prod.ok}`);
  console.log(`  state: ${prod.state}`);
  console.log(`  keyFingerprint: ${prod.keyFingerprint || 'n/a'}`);
  if (prod.reason) console.log(`  reason: ${prod.reason}`);

  if (local.keyFingerprint && prod.keyFingerprint && local.keyFingerprint !== prod.keyFingerprint) {
    console.log('\nMISMATCH — copy local UPLOADTHING_TOKEN to Render:');
    console.log('  node server/scripts/syncUploadthingToken.js --print-token');
    process.exit(1);
  }

  if (prod.ok) {
    console.log('\nProduction UploadThing config matches local fingerprint.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
