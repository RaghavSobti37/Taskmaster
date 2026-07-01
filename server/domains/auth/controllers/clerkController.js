const User = require('../../../models/User');
const logger = require('../../../utils/logger');
const { clearAuthCookie } = require('../../../utils/authCookie');
const { getDefaultSeedPassword } = require('../../../utils/defaultPassword');
const {
  isClerkConfigured,
  verifyClerkSessionToken,
  loadClerkProfile,
} = require('../../../utils/clerkAuth');
const { attachProfileCompletion } = require('../../../utils/profileCompleteness');
const { finishAuthSession } = require('../../../utils/sessionRegistry');
const { captureEvent: capturePostHogEvent } = require('../../../utils/posthog');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();

const isRegistrationAllowed = (emailLower) => {
  if (process.env.REGISTRATION_DISABLED === 'true' && process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Registration is disabled. Contact an administrator.' };
  }
  if (process.env.NODE_ENV !== 'production') return { ok: true };

  const domain = emailLower.split('@')[1] || '';
  if (ALLOWED_DOMAIN && domain !== ALLOWED_DOMAIN && emailLower !== ADMIN_EMAIL) {
    return { ok: false, error: 'Registration restricted to authorized email domain' };
  }
  return { ok: true };
};

const populateAuthUser = (userId) => User.findById(userId)
  .select('-password')
  .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

const resolveUserForClerk = async (profile) => {
  const { clerkId, email, name, avatar } = profile;
  if (!email) {
    return { error: 'Clerk account has no primary email address', status: 400 };
  }

  let user = await User.findOne({ clerkId });
  if (!user) {
    user = await User.findOne({ email });
  }

  if (!user) {
    const registrationCheck = isRegistrationAllowed(email);
    if (!registrationCheck.ok) {
      return { error: registrationCheck.error, status: 403 };
    }
    user = await User.create({
      name,
      email,
      clerkId,
      avatar,
      password: getDefaultSeedPassword(),
      mustChangePassword: true,
    });
  } else {
    const updates = {};
    if (!user.clerkId) updates.clerkId = clerkId;
    if (avatar && !user.avatar) updates.avatar = avatar;
    if (Object.keys(updates).length) {
      user = await User.findByIdAndUpdate(user._id, updates, { new: true });
    }
  }

  if (user.suspended) {
    return { error: 'Account suspended. Contact an administrator.', status: 403 };
  }

  return { user };
};

exports.clerkExchange = async (req, res) => {
  try {
    if (!isClerkConfigured()) {
      return res.status(503).json({ error: 'Clerk authentication is not configured' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing Clerk session token' });
    }

    let payload;
    try {
      payload = await verifyClerkSessionToken(token);
    } catch (error) {
      logger.warn('clerkController', 'Clerk token verification failed', {
        error: error.message || String(error),
      });
      return res.status(401).json({ error: 'Invalid Clerk session' });
    }

    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Invalid Clerk session' });
    }

    const profile = await loadClerkProfile(clerkUserId);
    const resolved = await resolveUserForClerk(profile);
    if (resolved.error) {
      if (resolved.status === 403) clearAuthCookie(res, req);
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const populated = await populateAuthUser(resolved.user._id);
    if (!populated) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    await finishAuthSession(req, res, populated._id);
    capturePostHogEvent(req, 'user_logged_in', { method: 'clerk' });
    return res.json(attachProfileCompletion(populated.toObject ? populated.toObject() : populated));
  } catch (error) {
    logger.error('clerkController', 'clerkExchange failed', { error: error.message || error });
    return res.status(500).json({ error: 'Failed to establish session' });
  }
};
