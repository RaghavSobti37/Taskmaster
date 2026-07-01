#!/usr/bin/env node
/**
 * Create Clerk users from CoreKnot Mongo users and link clerkId.
 *
 * Usage:
 *   node server/scripts/migrateUsersToClerk.js --email user@example.com
 *   node server/scripts/migrateUsersToClerk.js --staff-only --source local
 *   node server/scripts/migrateUsersToClerk.js --staff-only --source prod
 *   node server/scripts/migrateUsersToClerk.js --staff-only --source both
 *   node server/scripts/migrateUsersToClerk.js --domain example.com --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');
const {
  isClerkMigrationExcludedEmail,
  isStaffEmail,
} = require('../utils/clerkMigrationFilters');

const args = process.argv.slice(2);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);
const setPassword = hasFlag('--set-password');
const importPasswords = hasFlag('--import-passwords') || (!setPassword && !hasFlag('--no-import-passwords'));
const dryRun = hasFlag('--dry-run');
const initialPassword = readArg('--password') || process.env.CLERK_INITIAL_PASSWORD || '';

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ''));

const passwordFieldsFromMongo = (dbUser) => {
  const hash = dbUser.password;
  if (!importPasswords || !isBcryptHash(hash)) return {};
  return {
    password_digest: hash,
    password_hasher: 'bcrypt',
  };
};

const orgId = readArg('--org-id') || process.env.CLERK_ORGANIZATION_ID || '';
const emailFilter = readArg('--email');
const domainFilter = readArg('--domain') || '';
const migrateAll = hasFlag('--all');
const staffOnly = hasFlag('--staff-only');
const includeTest = hasFlag('--include-test');
const sourceArg = (readArg('--source') || 'local').toLowerCase();

const resolveMongoUri = (source) => {
  if (source === 'prod') {
    const uri = process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD;
    if (!uri) throw new Error('MONGODB_URI_PROD required for --source prod');
    return uri;
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  return uri;
};

const shouldIncludeUser = (dbUser) => {
  const email = String(dbUser.email || '').trim().toLowerCase();
  if (!email) return false;
  if (!includeTest && isClerkMigrationExcludedEmail(email)) return false;
  if (staffOnly) return isStaffEmail(email);
  if (emailFilter) return email === emailFilter.trim().toLowerCase();
  if (domainFilter) {
    const escaped = domainFilter.replace(/\./g, '\\.');
    return new RegExp(`@${escaped}$`, 'i').test(email);
  }
  return migrateAll;
};

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
};

const defaultUsername = (email) => {
  const local = String(email || '').split('@')[0] || 'user';
  let username = local.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) || 'user';
  if (username.length < 4) username = `${username}user`.slice(0, 32);
  return username;
};
const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'User', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const findClerkUserByEmail = async (email) => {
  const list = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
  return list?.data?.[0] || null;
};

const ensureOrgMembership = async (clerkUserId) => {
  if (!orgId) return { joined: false, reason: 'no org id' };
  try {
    const list = await clerkClient.users.getOrganizationMembershipList({
      userId: clerkUserId,
      limit: 100,
    });
    const already = (list?.data || []).some(
      (entry) => entry?.organization?.id === orgId || entry?.organizationId === orgId,
    );
    if (already) return { joined: true, reason: 'already member' };

    await clerkClient.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: clerkUserId,
      role: 'org:member',
    });
    return { joined: true };
  } catch (err) {
    const msg = String(err?.errors?.[0]?.message || err?.message || '');
    if (/already/i.test(msg)) return { joined: true, reason: 'already member' };
    return { joined: false, reason: msg || 'org membership failed' };
  }
};

const syncClerkIdByEmail = async (uri, email, clerkUserId) => {
  await mongoose.connect(uri);
  await User.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { clerkId: clerkUserId } },
  ).setOptions({ bypassTenant: true });
  await mongoose.disconnect();
};

const migrateOne = async (dbUser) => {
  const email = String(dbUser.email || '').trim().toLowerCase();
  if (!email) return { email, status: 'skipped', reason: 'no email' };

  const passwordImport = passwordFieldsFromMongo(dbUser);
  const hasPasswordImport = Boolean(passwordImport.password_digest);

  if (dryRun) {
    return {
      email,
      status: 'dry-run',
      hasClerkId: Boolean(dbUser.clerkId),
      importPassword: hasPasswordImport,
      role: dbUser.role || null,
    };
  }

  let clerkUser = dbUser.clerkId
    ? await clerkClient.users.getUser(dbUser.clerkId).catch(() => null)
    : null;
  if (!clerkUser) clerkUser = await findClerkUserByEmail(email);

  const metadata = {
    public_metadata: {
      coreknotUserId: String(dbUser._id),
      ...(dbUser.role ? { role: dbUser.role } : {}),
    },
  };

  if (!clerkUser) {
    const { firstName, lastName } = splitName(dbUser.name);
    const payload = {
      emailAddress: [email],
      username: defaultUsername(email),
      firstName,
      lastName: lastName || undefined,
      skipUserRequirement: true,
      ...metadata,
    };
    if (hasPasswordImport) {
      Object.assign(payload, passwordImport);
    } else {
      payload.skipPasswordRequirement = true;
      payload.skipPasswordChecks = true;
    }
    const phone = normalizePhone(dbUser.phone);
    if (phone) payload.phoneNumber = [phone];
    try {
      clerkUser = await clerkClient.users.createUser(payload);
    } catch (err) {
      const errors = err?.errors || [];
      const isPhoneRejection = errors.some(
        (e) => e?.code === 'unsupported_country_code' || e?.meta?.paramName === 'phone_number',
      );
      if (isPhoneRejection && payload.phoneNumber) {
        delete payload.phoneNumber;
        clerkUser = await clerkClient.users.createUser(payload);
      } else {
        throw err;
      }
    }
  } else if (hasPasswordImport && !(clerkUser.passwordEnabled ?? clerkUser.password_enabled)) {
    await clerkClient.users.updateUser(clerkUser.id, {
      ...passwordImport,
      ...metadata,
    });
    clerkUser = await clerkClient.users.getUser(clerkUser.id);
  } else {
    await clerkClient.users.updateUser(clerkUser.id, metadata);
  }

  const orgMembership = await ensureOrgMembership(clerkUser.id);

  if (setPassword && initialPassword) {
    await clerkClient.users.updateUser(clerkUser.id, { password: initialPassword });
    clerkUser = await clerkClient.users.getUser(clerkUser.id);
  }

  if (dbUser.clerkId !== clerkUser.id) {
    await User.updateOne(
      { _id: dbUser._id },
      { $set: { clerkId: clerkUser.id } },
    ).setOptions({ bypassTenant: true });
  }

  return {
    email,
    status: 'ok',
    clerkUserId: clerkUser.id,
    passwordEnabled: Boolean(clerkUser.passwordEnabled ?? clerkUser.password_enabled),
    importedPassword: hasPasswordImport,
    orgMembership,
  };
};

async function loadUsersFromSource(source) {
  const uri = resolveMongoUri(source);
  await mongoose.connect(uri);
  let query = {};
  if (emailFilter) {
    query.email = emailFilter.trim().toLowerCase();
  } else if (staffOnly) {
    const domain = process.env.ALLOWED_DOMAIN || 'theshakticollective.in';
    query.email = new RegExp(`@${domain.replace(/\./g, '\\.')}$`, 'i');
  } else if (!migrateAll && domainFilter) {
    query.email = new RegExp(`@${domainFilter.replace(/\./g, '\\.')}$`, 'i');
  } else if (!migrateAll) {
    await mongoose.disconnect();
    return [];
  }

  const users = await User.find(query)
    .select('+password email name clerkId phone role')
    .setOptions({ bypassTenant: true })
    .lean();
  await mongoose.disconnect();
  return users.filter(shouldIncludeUser).map((user) => ({ ...user, _source: source }));
}

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY required');
    process.exit(1);
  }
  if (setPassword && !initialPassword) {
    console.error('Pass --password or set CLERK_INITIAL_PASSWORD when using --set-password');
    process.exit(1);
  }

  if (!emailFilter && !staffOnly && !migrateAll && !domainFilter) {
    console.error('Pass --email, --domain, --staff-only, or --all');
    process.exit(1);
  }

  if (!['local', 'prod', 'both'].includes(sourceArg)) {
    console.error('--source must be local, prod, or both');
    process.exit(1);
  }

  const sources = sourceArg === 'both' ? ['local', 'prod'] : [sourceArg];
  const byEmail = new Map();
  for (const source of sources) {
    const batch = await loadUsersFromSource(source);
    for (const dbUser of batch) {
      const key = String(dbUser.email || '').trim().toLowerCase();
      if (!key) continue;
      if (!byEmail.has(key)) byEmail.set(key, dbUser);
    }
  }

  const users = [...byEmail.values()];
  if (!users.length) {
    console.log('No matching users in MongoDB');
    return;
  }

  const primarySource = users[0]._source || sources[0];
  await mongoose.connect(resolveMongoUri(primarySource));

  const results = [];
  for (const dbUser of users) {
    const writeSource = dbUser._source || primarySource;
    try {
      if (writeSource !== primarySource) {
        await mongoose.disconnect();
        await mongoose.connect(resolveMongoUri(writeSource));
      }
      const outcome = await migrateOne(dbUser);
      results.push({ ...outcome, source: writeSource });

      if (outcome.status === 'ok' && outcome.clerkUserId && sourceArg === 'both') {
        for (const mirrorSource of ['local', 'prod']) {
          if (mirrorSource === writeSource) continue;
          try {
            await syncClerkIdByEmail(resolveMongoUri(mirrorSource), dbUser.email, outcome.clerkUserId);
          } catch {
            // ponytail: best-effort mirror clerkId across env DBs
          }
        }
        await mongoose.connect(resolveMongoUri(writeSource));
      }
    } catch (err) {
      results.push({
        email: dbUser.email,
        status: 'error',
        source: writeSource,
        reason: err?.errors?.[0]?.message || err?.message || String(err),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        importPasswords,
        staffOnly,
        includeTest,
        source: sourceArg,
        orgId: orgId || null,
        count: results.length,
        joined: results.filter((r) => r.orgMembership?.joined).length,
        results,
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
