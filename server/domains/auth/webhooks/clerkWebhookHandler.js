const { Webhook } = require('svix');
const User = require('../../../models/User');
const logger = require('../../../utils/logger');
const { revokeAllUserSessions } = require('../../../utils/sessionRegistry');
const { invalidateAuthUserCache } = require('../../../utils/authUserLookup');

const verifyClerkWebhook = (req) => {
  const secret = String(process.env.CLERK_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    const err = new Error('CLERK_WEBHOOK_SECRET not configured');
    err.status = 503;
    throw err;
  }
  const wh = new Webhook(secret);
  const payload = req.rawBody
    ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody))
    : JSON.stringify(req.body || {});
  return wh.verify(payload, {
    'svix-id': req.headers['svix-id'],
    'svix-timestamp': req.headers['svix-timestamp'],
    'svix-signature': req.headers['svix-signature'],
  });
};

const primaryEmail = (clerkUser = {}) => {
  const addresses = clerkUser.data?.email_addresses || clerkUser.email_addresses || [];
  const primaryId = clerkUser.data?.primary_email_address_id || clerkUser.primary_email_address_id;
  const primary = addresses.find((e) => e.id === primaryId) || addresses[0];
  return primary?.email_address?.toLowerCase?.().trim() || null;
};

const displayName = (clerkUser = {}) => {
  const data = clerkUser.data || clerkUser;
  const parts = [data.first_name, data.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ').trim();
  const email = primaryEmail(clerkUser);
  return email?.split('@')[0] || 'User';
};

async function handleUserCreated(event) {
  const clerkUserId = event.data?.id;
  const email = primaryEmail(event);
  if (!email || !clerkUserId) return { action: 'skipped', reason: 'missing_email_or_id' };

  const user = await User.findOne({ email }).setOptions({ bypassTenant: true });
  if (!user) {
    return { action: 'skipped', reason: 'coreknot_user_not_provisioned' };
  }

  if (user.clerkId !== clerkUserId) {
    user.clerkId = clerkUserId;
    await user.save();
    await invalidateAuthUserCache(user._id);
  }
  return { action: 'linked', userId: user._id.toString() };
}

async function handleUserUpdated(event) {
  const clerkUserId = event.data?.id;
  const email = primaryEmail(event);
  if (!clerkUserId) return { action: 'skipped', reason: 'missing_id' };

  const user = await User.findOne({ clerkId: clerkUserId }).setOptions({ bypassTenant: true })
    || (email ? await User.findOne({ email }).setOptions({ bypassTenant: true }) : null);
  if (!user) return { action: 'skipped', reason: 'user_not_found' };

  const patch = {};
  const name = displayName(event);
  if (name && user.name !== name) patch.name = name;
  if (email && user.email !== email) patch.email = email;
  if (!user.clerkId) patch.clerkId = clerkUserId;

  if (Object.keys(patch).length) {
    Object.assign(user, patch);
    await user.save();
    await invalidateAuthUserCache(user._id);
  }
  return { action: 'updated', userId: user._id.toString() };
}

async function handleUserDeleted(event) {
  const clerkUserId = event.data?.id;
  if (!clerkUserId) return { action: 'skipped', reason: 'missing_id' };

  const user = await User.findOne({ clerkId: clerkUserId }).setOptions({ bypassTenant: true });
  if (!user) return { action: 'skipped', reason: 'user_not_found' };

  user.suspended = true;
  user.suspendedAt = user.suspendedAt || new Date();
  user.suspensionReason = user.suspensionReason || 'Clerk user deleted (webhook deprovision)';
  await user.save();
  await revokeAllUserSessions(user._id.toString());
  await invalidateAuthUserCache(user._id);
  return { action: 'suspended', userId: user._id.toString() };
}

async function handleClerkWebhook(req, res) {
  try {
    const event = verifyClerkWebhook(req);
    const type = event?.type;
    let result = { action: 'ignored', type };

    switch (type) {
      case 'user.created':
        result = { ...await handleUserCreated(event), type };
        break;
      case 'user.updated':
        result = { ...await handleUserUpdated(event), type };
        break;
      case 'user.deleted':
        result = { ...await handleUserDeleted(event), type };
        break;
      default:
        logger.info('clerkWebhook', 'Unhandled event type', { type });
    }

    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    const status = error.status || 400;
    logger.warn('clerkWebhook', 'Webhook failed', { error: error.message, status });
    return res.status(status).json({ error: error.message || 'Webhook verification failed' });
  }
}

module.exports = {
  handleClerkWebhook,
  handleUserCreated,
  handleUserUpdated,
  handleUserDeleted,
};
