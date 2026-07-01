#!/usr/bin/env node
/**
 * Create Clerk users from CoreKnot Mongo users and link clerkId.
 *
 * Usage:
 *   node server/scripts/migrateUsersToClerk.js --email user@example.com
 *   node server/scripts/migrateUsersToClerk.js --domain example.com
 *   node server/scripts/migrateUsersToClerk.js --all
 *   node server/scripts/migrateUsersToClerk.js --domain example.com --dry-run
 *   node server/scripts/migrateUsersToClerk.js --domain example.com --import-passwords
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');

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
const domainFilter = readArg('--domain') || process.env.ALLOWED_DOMAIN || '';
const migrateAll = hasFlag('--all');

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
      const code = err?.errors?.[0]?.code || '';
      if (code === 'unsupported_country_code' && payload.phoneNumber) {
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

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY required');
    process.exit(1);
  }
  if (setPassword && !initialPassword) {
    console.error('Pass --password or set CLERK_INITIAL_PASSWORD when using --set-password');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let query = {};
  if (emailFilter) {
    query.email = emailFilter.trim().toLowerCase();
  } else if (!migrateAll && domainFilter) {
    query.email = new RegExp(`@${domainFilter.replace(/\./g, '\\.')}$`, 'i');
  } else if (!migrateAll) {
    console.error('Pass --email, --domain, or --all');
    process.exit(1);
  }

  const users = await User.find(query)
    .select('+password email name clerkId phone role')
    .setOptions({ bypassTenant: true })
    .lean();
  if (!users.length) {
    console.log('No matching users in MongoDB');
    await mongoose.disconnect();
    return;
  }

  const results = [];
  for (const dbUser of users) {
    try {
      results.push(await migrateOne(dbUser));
    } catch (err) {
      results.push({
        email: dbUser.email,
        status: 'error',
        reason: err?.errors?.[0]?.message || err?.message || String(err),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        importPasswords,
        orgId: orgId || null,
        count: results.length,
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
