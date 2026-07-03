const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkConfigured } = require('./clerkAuth');
const { pinnedClerkOrganizationId } = require('./organizationAccess');
const logger = require('./logger');

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'User', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const defaultUsername = (email) => {
  const local = String(email || '').split('@')[0] || 'user';
  let username = local.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) || 'user';
  if (username.length < 4) username = `${username}user`.slice(0, 32);
  return username;
};

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
};

const findClerkUserByEmail = async (email) => {
  const list = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
  return list?.data?.[0] || null;
};

const ensureClerkOrgMembership = async (clerkUserId) => {
  const orgId = pinnedClerkOrganizationId();
  if (!orgId || !clerkUserId) return { joined: false, reason: 'no org id' };
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
    logger.warn('clerkUserProvisioning', 'org membership failed', { clerkUserId, error: msg });
    return { joined: false, reason: msg || 'org membership failed' };
  }
};

const buildClerkMetadata = (dbUserId) => ({
  public_metadata: {
    coreknotUserId: String(dbUserId),
  },
});

/**
 * Create or link a Clerk user for a CoreKnot account (admin onboarding).
 * @returns {Promise<{ clerkUserId: string, created: boolean }>}
 */
const provisionClerkUserForCoreKnotUser = async ({
  email,
  name,
  phone,
  plainPassword,
  dbUserId,
}) => {
  if (!isClerkConfigured()) {
    const err = new Error('Clerk is not configured');
    err.status = 503;
    throw err;
  }

  const emailLower = String(email || '').trim().toLowerCase();
  if (!emailLower) {
    const err = new Error('Email is required for Clerk provisioning');
    err.status = 400;
    throw err;
  }
  if (!plainPassword) {
    const err = new Error('Temporary password is required for Clerk provisioning');
    err.status = 400;
    throw err;
  }

  let clerkUser = await findClerkUserByEmail(emailLower);
  let created = false;

  if (!clerkUser) {
    const { firstName, lastName } = splitName(name);
    const payload = {
      emailAddress: [emailLower],
      username: defaultUsername(emailLower),
      firstName,
      lastName: lastName || undefined,
      password: plainPassword,
      skipPasswordRequirement: false,
      skipPasswordChecks: false,
      ...buildClerkMetadata(dbUserId),
    };
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) payload.phoneNumber = [normalizedPhone];
    try {
      clerkUser = await clerkClient.users.createUser(payload);
      created = true;
    } catch (err) {
      const errors = err?.errors || [];
      const isPhoneRejection = errors.some(
        (e) => e?.code === 'unsupported_country_code' || e?.meta?.paramName === 'phone_number',
      );
      if (isPhoneRejection && payload.phoneNumber) {
        delete payload.phoneNumber;
        clerkUser = await clerkClient.users.createUser(payload);
        created = true;
      } else {
        throw err;
      }
    }
  } else {
    await clerkClient.users.updateUser(clerkUser.id, {
      password: plainPassword,
      ...buildClerkMetadata(dbUserId),
    });
    clerkUser = await clerkClient.users.getUser(clerkUser.id);
  }

  await ensureClerkOrgMembership(clerkUser.id);

  return { clerkUserId: clerkUser.id, created };
};

/**
 * Sync a plaintext password to Clerk after CoreKnot password change.
 */
const syncClerkUserPassword = async (clerkId, plainPassword) => {
  if (!isClerkConfigured() || !clerkId || !plainPassword) {
    return { synced: false, reason: 'not_configured_or_missing' };
  }
  try {
    await clerkClient.users.updateUser(clerkId, { password: plainPassword });
    return { synced: true };
  } catch (err) {
    const message = err?.errors?.[0]?.message || err?.message || 'Clerk password sync failed';
    logger.error('clerkUserProvisioning', 'syncClerkUserPassword failed', {
      clerkId,
      error: message,
    });
    const error = new Error(message);
    error.status = 502;
    throw error;
  }
};

module.exports = {
  splitName,
  defaultUsername,
  normalizePhone,
  findClerkUserByEmail,
  ensureClerkOrgMembership,
  provisionClerkUserForCoreKnotUser,
  syncClerkUserPassword,
};
