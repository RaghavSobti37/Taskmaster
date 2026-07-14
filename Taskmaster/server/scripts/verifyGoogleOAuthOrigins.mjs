#!/usr/bin/env node
/**
 * Audit Clerk + env for Google OAuth on auth.tsccoreknot.com.
 * Cannot verify Google Cloud Console JS origins (manual step) — prints checklist.
 *
 * Usage:
 *   node server/scripts/verifyGoogleOAuthOrigins.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

dotenv.config({ path: path.join(ROOT, '.cursor/clerk-production.local.env') });
dotenv.config({ path: path.join(ROOT, 'server/.env') });

const REQUIRED_JS_ORIGINS = [
  'https://auth.tsccoreknot.com',
  'https://tsccoreknot.com',
  'https://www.tsccoreknot.com',
  'https://landing.tsccoreknot.com',
];

const REQUIRED_REDIRECT_URIS = [
  'https://tsccoreknot.com/__clerk/v1/oauth_callback',
  'https://clerk.tsccoreknot.com/v1/oauth_callback',
  'https://CoreKnot-jfw0.onrender.com/api/auth/google/callback',
  'https://CoreKnot-jfw0.onrender.com/api/google/accounts/callback',
];

const STAFF_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID
  || '315959957968-2fgkpca1qj077fdj92uc1boffetbaf66.apps.googleusercontent.com';

const sk = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY_LIVE || '';
const pk =
  process.env.VITE_CLERK_PUBLISHABLE_KEY
  || process.env.CLERK_PUBLISHABLE_KEY_LIVE
  || '';

let clerkOk = true;
let googleConsoleManual = true;

async function main() {
  console.log('Google OAuth origin audit — auth.tsccoreknot.com\n');

  if (!sk.startsWith('sk_live_')) {
    console.warn('⚠ CLERK_SECRET_KEY (sk_live_) not loaded — skip Clerk API checks');
    clerkOk = false;
  } else {
    const instRes = await fetch('https://api.clerk.com/v1/instance', {
      headers: { Authorization: `Bearer ${sk}` },
    });
    if (!instRes.ok) {
      console.error('Clerk /instance failed:', instRes.status, await instRes.text());
      clerkOk = false;
    } else {
      const inst = await instRes.json();
      const origins = inst.allowed_origins || [];
      console.log('Clerk allowed_origins:');
      for (const o of REQUIRED_JS_ORIGINS) {
        const ok = origins.includes(o);
        console.log(`  ${ok ? '✓' : '✗'} ${o}`);
        if (!ok) clerkOk = false;
      }
      const extra = origins.filter((o) => !REQUIRED_JS_ORIGINS.includes(o));
      if (extra.length) console.log('  (also):', extra.join(', '));
    }
  }

  if (pk.startsWith('pk_live_')) {
    const envRes = await fetch('https://tsccoreknot.com/__clerk/v1/environment');
    if (envRes.ok) {
      const env = await envRes.json();
      const clerkGoogleId = env?.display_config?.google_one_tap_client_id || '';
      const googleEnabled = env?.user_settings?.social?.oauth_google?.enabled;
      console.log('\nClerk environment:');
      console.log(`  oauth_google enabled: ${googleEnabled ? 'yes' : 'no'}`);
      console.log(`  google_one_tap_client_id: ${clerkGoogleId || '(missing)'}`);
      if (clerkGoogleId && clerkGoogleId !== STAFF_CLIENT_ID) {
        console.warn(`  ⚠ Mismatch with GOOGLE_CLIENT_ID: ${STAFF_CLIENT_ID}`);
        clerkOk = false;
      } else if (clerkGoogleId) {
        console.log('  ✓ Matches server GOOGLE_CLIENT_ID');
      }
    } else {
      console.warn('Could not fetch Clerk environment:', envRes.status);
    }
  }

  console.log('\n--- Google Cloud Console (manual) ---');
  console.log(`OAuth client: ${STAFF_CLIENT_ID}`);
  console.log('\nAuthorized JavaScript origins — add any missing:');
  for (const o of REQUIRED_JS_ORIGINS) console.log(`  • ${o}`);
  console.log('\nAuthorized redirect URIs — add any missing:');
  for (const u of REQUIRED_REDIRECT_URIS) console.log(`  • ${u}`);

  console.log('\nFull steps: docs/google-oauth-auth-subdomain.md');

  if (!clerkOk) {
    console.error('\nFAIL: Clerk configuration incomplete. Run: node server/scripts/configureClerkProduction.mjs');
    process.exit(1);
  }

  console.log('\nClerk: OK');
  console.log(
    'Google Console: MANUAL — add JS origins above if [GSI_LOGGER] origin error persists on /login',
  );
  // ponytail: no GCP credentials in repo; cannot API-check Google Console origins
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
