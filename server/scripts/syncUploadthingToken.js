/**
 * Print UploadThing env status + Render copy instructions.
 * UploadThing v7 route handler signs presigned URLs from UPLOADTHING_TOKEN only (not SECRET).
 *
 * Run: node server/scripts/syncUploadthingToken.js
 *      node server/scripts/syncUploadthingToken.js --print-token
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const {
  parseUploadthingToken,
  validateUploadthingCredentials,
  fingerprintApiKey,
} = require('../utils/uploadthingCredentials');

const envPath = path.join(__dirname, '../.env');
const renderEnvPath = path.join(__dirname, '../.env.render');
const printToken = process.argv.includes('--print-token');

function writeTokenToEnvFile(filePath, encoded) {
  if (!fs.existsSync(filePath)) return false;
  let envText = fs.readFileSync(filePath, 'utf8');
  if (/^UPLOADTHING_TOKEN=/m.test(envText)) {
    envText = envText.replace(/^UPLOADTHING_TOKEN=.*$/m, `UPLOADTHING_TOKEN="${encoded}"`);
  } else {
    envText += `\nUPLOADTHING_TOKEN="${encoded}"\n`;
  }
  fs.writeFileSync(filePath, envText);
  return true;
}

let raw = String(process.env.UPLOADTHING_TOKEN || '').replace(/^"|"$/g, '');
let tokenData = parseUploadthingToken(raw);
if (!tokenData?.apiKey) {
  console.error('Bad or missing UPLOADTHING_TOKEN in server/.env');
  process.exit(1);
}

const secret = process.env.UPLOADTHING_SECRET || '';
const creds = validateUploadthingCredentials();

console.log('UploadThing v7 uses UPLOADTHING_TOKEN for signing (SECRET is legacy UTApi only).');
console.log(`  appId: ${creds.appId || tokenData.appId || 'unknown'}`);
console.log(`  token apiKey: ${fingerprintApiKey(tokenData.apiKey)}`);
if (secret) {
  console.log(`  UPLOADTHING_SECRET: ${fingerprintApiKey(secret)}`);
  console.log(`  token/secret match: ${tokenData.apiKey === secret ? 'yes' : 'NO — run without --print-token to fix local .env'}`);
}

if (renderEnvPath && fs.existsSync(renderEnvPath)) {
  const renderRaw = fs.readFileSync(renderEnvPath, 'utf8');
  const renderMatch = renderRaw.match(/^UPLOADTHING_TOKEN=(.*)$/m);
  if (renderMatch) {
    const renderToken = parseUploadthingToken(renderMatch[1]);
    const renderFp = fingerprintApiKey(renderToken?.apiKey);
    console.log(`  .env.render token: ${renderFp || 'invalid'}`);
    if (renderToken?.apiKey && renderToken.apiKey !== tokenData.apiKey) {
      console.log('  WARNING: server/.env.render TOKEN does not match local — Render dashboard may still be wrong.');
    }
  }
}

if (!creds.ok) {
  tokenData.apiKey = secret;
  const encoded = Buffer.from(JSON.stringify(tokenData)).toString('base64');
  writeTokenToEnvFile(envPath, encoded);
  if (writeTokenToEnvFile(renderEnvPath, encoded)) {
    console.log('\nFixed server/.env.render UPLOADTHING_TOKEN — paste same value into Render dashboard.');
  }
  console.log('Fixed local .env — TOKEN apiKey synced to UPLOADTHING_SECRET.');
  raw = encoded;
  tokenData = parseUploadthingToken(encoded);
} else {
  console.log('\nLocal .env OK.');
}

console.log('\nRender / production checklist:');
console.log('  1. Paste THIS machine\'s UPLOADTHING_TOKEN into Render (must match local fingerprint above).');
console.log('  2. SECRET is optional for client uploads; TOKEN is what matters.');
console.log('  3. Deploy latest API (callback auth fix on /api/uploadthing).');
console.log('  4. After deploy, verify: GET /api/health → dependencies.uploadthing.keyFingerprint');

if (printToken) {
  console.log('\n--- UPLOADTHING_TOKEN (copy to Render) ---');
  console.log(raw);
  console.log('--- end ---');
}
