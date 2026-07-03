const { verifyToken, clerkClient } = require('@clerk/clerk-sdk-node');
const crypto = require('crypto');
const User = require('../models/User');
const { ensurePlatformTenant } = require('./defaultTenant');

const MOCK_SECRET = 'mock_clerk_secret';

const populateDepartment = (query) =>
  query.populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

const isClerkConfigured = () => {
  const key = String(process.env.CLERK_SECRET_KEY || '').trim();
  return Boolean(key && key !== MOCK_SECRET);
};

const primaryClerkEmail = (clerkUser) => {
  const addresses = clerkUser?.emailAddresses || [];
  const primaryId = clerkUser?.primaryEmailAddressId;
  const primary = addresses.find((entry) => entry.id === primaryId) || addresses[0];
  return primary?.emailAddress?.toLowerCase?.().trim() || null;
};

const resolveClerkDisplayName = (clerkUser, email) => {
  const parts = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ').trim();
  const username = String(clerkUser?.username || '').trim();
  if (username) return username;
  return email?.split('@')[0] || 'User';
};

/**
 * Verify a Clerk session JWT and return normalized profile fields.
 * @returns {Promise<{ clerkUserId: string, email: string, name: string } | null>}
 */
const extractClerkOrganizationId = (verified) => {
  if (!verified) return null;
  const direct = verified.org_id || verified.orgId;
  if (direct) return String(direct);
  const nested = verified.o?.id || verified.organization_id;
  return nested ? String(nested) : null;
};

const verifyClerkSessionToken = async (token) => {
  if (!isClerkConfigured() || !token) return null;
  try {
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    if (!verified?.sub) return null;
    const clerkUser = await clerkClient.users.getUser(verified.sub);
    const email = primaryClerkEmail(clerkUser);
    if (!email) return null;
    return {
      clerkUserId: verified.sub,
      email,
      name: resolveClerkDisplayName(clerkUser, email),
      clerkOrganizationId: extractClerkOrganizationId(verified),
    };
  } catch {
    return null;
  }
};

/**
 * Find or create a CoreKnot user from a verified Clerk profile.
 * @param {{ clerkUserId: string, email: string, name: string }} profile
 * @param {{ isRegistrationAllowed: (email: string) => { ok: boolean, error?: string } }} guards
 */
const resolveUserFromClerkProfile = async (profile, guards = {}) => {
  const email = profile.email?.toLowerCase?.().trim();
  if (!email) {
    const err = new Error('Clerk account has no email');
    err.status = 400;
    throw err;
  }

  let dbUser = await populateDepartment(
    User.findOne({ email }).select('-password').setOptions({ bypassTenant: true }),
  );
  if (!dbUser) {
    const allowed = guards.isRegistrationAllowed
      ? guards.isRegistrationAllowed(email)
      : { ok: true };
    if (!allowed.ok) {
      const err = new Error(allowed.error || 'Registration not allowed');
      err.status = 403;
      throw err;
    }
    let tenantId = guards.tenantId || null;
    if (!tenantId) {
      try {
        tenantId = await ensurePlatformTenant();
      } catch (err) {
        console.error('[clerkAuth] platform tenant bootstrap failed during user creation:', err?.message || err);
        const fail = new Error('Workspace tenant is not configured. Contact an administrator.');
        fail.status = 503;
        throw fail;
      }
    }
    const createPayload = {
      name: profile.name || email.split('@')[0],
      email,
      password: crypto.randomBytes(32).toString('hex'),
      mustChangePassword: true,
      clerkId: profile.clerkUserId,
      ...(tenantId ? { tenantId } : {}),
    };
    dbUser = await User.create(createPayload);
    dbUser = await populateDepartment(
      User.findById(dbUser._id).select('-password').setOptions({ bypassTenant: true }),
    );
  } else {
    const patch = {};
    if (profile.clerkUserId && dbUser.clerkId !== profile.clerkUserId) {
      patch.clerkId = profile.clerkUserId;
      dbUser.clerkId = profile.clerkUserId;
    }
    if (guards.tenantId && !dbUser.tenantId) {
      patch.tenantId = guards.tenantId;
      dbUser.tenantId = guards.tenantId;
    }
    if (Object.keys(patch).length) {
      await User.updateOne({ _id: dbUser._id }, { $set: patch }).setOptions({ bypassTenant: true });
    }
  }

  return dbUser;
};

module.exports = {
  isClerkConfigured,
  verifyClerkSessionToken,
  resolveUserFromClerkProfile,
  primaryClerkEmail,
};
