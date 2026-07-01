#!/usr/bin/env node
/**
 * Sync production Clerk org members into the dev Clerk org (separate instances).
 * - Sets dev org + instance default membership limit to 20
 * - Creates missing dev Clerk users from prod Mongo (password bcrypt import when available)
 * - Adds them to dev org; never writes dev clerkIds to production Mongo
 *
 * Usage:
 *   node server/scripts/syncClerkProdOrgToDev.js
 *   node server/scripts/syncClerkProdOrgToDev.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

const PROD_ORG_ID = 'org_3FuGBGD2rKedHGXGHGynClErbbq';
const DEV_ORG_ID = 'org_3FuRwJBYTGL68bXDrOsfCmziAfR';
const MEMBERSHIP_LIMIT = 20;
const CLERK_API = 'https://api.clerk.com/v1';

const dryRun = process.argv.includes('--dry-run');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function loadKeys() {
  const root = path.join(__dirname, '../..');
  const prodLocal = parseEnvFile(path.join(root, '.cursor', 'clerk-production.local.env'));
  const prodSk = prodLocal.CLERK_SECRET_KEY || '';
  const devSk = process.env.CLERK_SECRET_KEY || '';
  if (!prodSk.startsWith('sk_live_')) {
    throw new Error('Missing sk_live_ in .cursor/clerk-production.local.env');
  }
  if (!devSk.startsWith('sk_test_')) {
    throw new Error('Missing sk_test_ CLERK_SECRET_KEY in server/.env');
  }
  return { prodSk, devSk };
}

function clerkRows(body) {
  if (Array.isArray(body)) return body;
  return body?.data || [];
}

async function clerkFetch(sk, method, urlPath, body) {
  const res = await fetch(`${CLERK_API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${sk}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = data?.errors || (Array.isArray(data) ? [] : []);
    const msg = errors[0]?.message || data?.message || res.statusText;
    const err = new Error(msg || `Clerk ${method} ${urlPath} failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function patchOrgLimit(sk, orgId, limit) {
  if (dryRun) return { id: orgId, max_allowed_memberships: limit, dryRun: true };
  return clerkFetch(sk, 'PATCH', `/organizations/${orgId}`, { max_allowed_memberships: limit });
}

async function patchInstanceLimit(sk, limit) {
  if (dryRun) return { max_allowed_memberships: limit, dryRun: true };
  return clerkFetch(sk, 'PATCH', '/instance/organization_settings', { max_allowed_memberships: limit });
}

async function listOrgMembers(sk, orgId) {
  const mem = await clerkFetch(sk, 'GET', `/organizations/${orgId}/memberships?limit=100`);
  const members = [];
  for (const entry of clerkRows(mem)) {
    const userId = entry.public_user_data?.user_id || entry.user_id;
    if (!userId) continue;
    const user = await clerkFetch(sk, 'GET', `/users/${userId}`);
    const email = (user.email_addresses || [])
      .find((e) => e.id === user.primary_email_address_id)?.email_address
      || user.email_addresses?.[0]?.email_address
      || '';
    members.push({
      clerkUserId: userId,
      email: String(email).trim().toLowerCase(),
      role: entry.role || 'org:member',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
    });
  }
  return members;
}

async function findUserByEmail(sk, email) {
  const normalized = String(email).trim().toLowerCase();
  const matchFromRows = (rows) => rows.find((u) => (u.email_addresses || []).some(
    (e) => String(e.email_address || '').toLowerCase() === normalized,
  )) || null;

  const filtered = await clerkFetch(
    sk,
    'GET',
    `/users?email_address=${encodeURIComponent(normalized)}&limit=10`,
  );
  const filteredHit = matchFromRows(clerkRows(filtered));
  if (filteredHit) return filteredHit;

  let offset = 0;
  while (offset < 500) {
    const page = await clerkFetch(sk, 'GET', `/users?limit=100&offset=${offset}`);
    const rows = clerkRows(page);
    if (!rows.length) break;
    const hit = matchFromRows(rows);
    if (hit) return hit;
    if (rows.length < 100) break;
    offset += 100;
  }
  return null;
}

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ''));

const defaultUsername = (email) => {
  const local = String(email || '').split('@')[0] || 'user';
  let username = local.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) || 'user';
  if (username.length < 4) username = `${username}user`.slice(0, 32);
  return username;
};

async function loadProdMongoUser(email) {
  const uri = process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD;
  if (!uri) return null;
  await mongoose.connect(uri);
  const doc = await User.findOne({ email: email.trim().toLowerCase() })
    .select('+password email name role clerkId')
    .setOptions({ bypassTenant: true })
    .lean();
  await mongoose.disconnect();
  return doc;
}

async function updateLocalClerkId(email, clerkUserId) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri || dryRun) return;
  await mongoose.connect(uri);
  await User.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { clerkId: clerkUserId } },
  ).setOptions({ bypassTenant: true });
  await mongoose.disconnect();
}

async function ensureDevUser(devSk, prodMember, mongoUser) {
  let devUser = await findUserByEmail(devSk, prodMember.email);
  if (devUser) {
    return { clerkUserId: devUser.id, created: false };
  }

  const payload = {
    email_address: [prodMember.email],
    username: defaultUsername(prodMember.email),
    first_name: prodMember.firstName || mongoUser?.name?.split(/\s+/)[0] || 'User',
    last_name: prodMember.lastName || mongoUser?.name?.split(/\s+/).slice(1).join(' ') || undefined,
    skip_legal_checks: true,
    public_metadata: {
      ...(mongoUser?._id ? { coreknotUserId: String(mongoUser._id) } : {}),
      ...(mongoUser?.role ? { role: mongoUser.role } : {}),
      syncedFromProduction: true,
    },
  };

  const hash = mongoUser?.password;
  if (isBcryptHash(hash)) {
    payload.password_digest = hash;
    payload.password_hasher = 'bcrypt';
  } else {
    payload.skip_password_requirement = true;
    payload.skip_password_checks = true;
  }

  if (dryRun) {
    return { clerkUserId: null, created: true, dryRun: true };
  }

  devUser = await clerkFetch(devSk, 'POST', '/users', payload);
  return { clerkUserId: devUser.id, created: true };
}

async function ensureDevOrgMembership(devSk, clerkUserId, role) {
  const memberships = await clerkFetch(
    devSk,
    'GET',
    `/users/${clerkUserId}/organization_memberships?limit=100`,
  );
  const already = clerkRows(memberships).some(
    (m) => m.organization?.id === DEV_ORG_ID || m.organization_id === DEV_ORG_ID,
  );
  if (already) return { joined: true, reason: 'already member' };
  if (dryRun) return { joined: true, reason: 'dry-run' };

  await clerkFetch(devSk, 'POST', `/organizations/${DEV_ORG_ID}/memberships`, {
    user_id: clerkUserId,
    role: role || 'org:member',
  });
  return { joined: true, reason: 'added' };
}

async function main() {
  const { prodSk, devSk } = loadKeys();

  const limits = {
    devOrg: await patchOrgLimit(devSk, DEV_ORG_ID, MEMBERSHIP_LIMIT),
    devInstance: await patchInstanceLimit(devSk, MEMBERSHIP_LIMIT),
    prodOrg: await clerkFetch(prodSk, 'GET', `/organizations/${PROD_ORG_ID}?include_members_count=true`),
  };

  const prodMembers = await listOrgMembers(prodSk, PROD_ORG_ID);
  const devMembersBefore = await listOrgMembers(devSk, DEV_ORG_ID);
  const devEmailsBefore = new Set(devMembersBefore.map((m) => m.email));

  const results = [];
  for (const member of prodMembers) {
    if (!member.email) {
      results.push({ email: member.email, status: 'skipped', reason: 'no email' });
      continue;
    }
    try {
      const mongoUser = await loadProdMongoUser(member.email);
      const userOutcome = await ensureDevUser(devSk, member, mongoUser);
      const clerkUserId = userOutcome.clerkUserId || (
        userOutcome.dryRun ? '(dry-run)' : null
      );

      let membership = { joined: false, reason: 'no user id' };
      if (clerkUserId && clerkUserId !== '(dry-run)') {
        membership = await ensureDevOrgMembership(devSk, clerkUserId, member.role);
        await updateLocalClerkId(member.email, clerkUserId);
      } else if (userOutcome.dryRun) {
        membership = {
          joined: !devEmailsBefore.has(member.email),
          reason: devEmailsBefore.has(member.email) ? 'already member' : 'would add',
        };
      }

      results.push({
        email: member.email,
        status: 'ok',
        prodClerkUserId: member.clerkUserId,
        devClerkUserId: clerkUserId,
        devUserCreated: userOutcome.created,
        membership,
        wasInDevOrgBefore: devEmailsBefore.has(member.email),
      });
    } catch (err) {
      results.push({
        email: member.email,
        status: 'error',
        reason: err?.data?.errors?.[0]?.message || err.message,
      });
    }
  }

  const devMembersAfter = dryRun
    ? devMembersBefore
    : await listOrgMembers(devSk, DEV_ORG_ID);

  console.log(JSON.stringify({
    dryRun,
    limits: {
      productionOrg: {
        id: PROD_ORG_ID,
        max_allowed_memberships: limits.prodOrg.max_allowed_memberships,
        members_count: limits.prodOrg.members_count,
      },
      developmentOrg: {
        id: DEV_ORG_ID,
        max_allowed_memberships: limits.devOrg.max_allowed_memberships,
      },
      developmentInstanceDefault: limits.devInstance.max_allowed_memberships,
    },
    prodMemberCount: prodMembers.length,
    devMemberCountBefore: devMembersBefore.length,
    devMemberCountAfter: devMembersAfter.length,
    devMembersAfter: devMembersAfter.map((m) => m.email).sort(),
    results,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
