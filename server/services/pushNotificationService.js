const webpush = require('web-push');
const User = require('../models/User');
const logger = require('../utils/logger');
const { dedupePushSubscriptions } = require('../utils/pushSubscriptions');

let configured = false;

const configureWebPush = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@coreknot.app';
  if (!publicKey || !privateKey) {
    logger.warn('Push', 'Web Push disabled — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys)');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  logger.debug('Push', 'Web Push configured', { subject });
  return true;
};

const sendPushToUser = async (userId, payload) => {
  if (!configured && !configureWebPush()) return;
  try {
    const user = await User.findById(userId).select('pushSubscriptions');
    const targets = dedupePushSubscriptions(user?.pushSubscriptions || []);
    if (!targets.length) return;

    const body = JSON.stringify(payload);
    const dead = [];

    await Promise.all(targets.map(async (sub) => {
      const idx = user.pushSubscriptions.findIndex((s) => s.endpoint === sub.endpoint);
      if (idx < 0) return;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
      } catch (err) {
        if ([403, 404, 410].includes(err.statusCode)) dead.push(idx);
        else logger.error('Push', 'Send failed', { error: err.message });
      }
    }));

    if (dead.length) {
      user.pushSubscriptions = user.pushSubscriptions.filter((_, i) => !dead.includes(i));
      await user.save();
    }
  } catch (err) {
    logger.error('Push', 'sendPushToUser', { error: err.message });
  }
};

const buildTestPushPayload = ({ title, body, actionUrl } = {}) => {
  const notificationId = `test-push-${Date.now()}`;
  return {
    title: title || '[TEST] CoreKnot Push',
    body: body || 'Test push — if you see this, notifications are working on your device.',
    actionUrl: actionUrl || '/settings/notifications',
    notificationId,
    category: 'system',
    iconType: 'system',
  };
};

/** Admin smoke test — web push only (no inbox row or email). */
const broadcastTestPush = async (overrides = {}) => {
  if (!configured && !configureWebPush()) {
    return { ok: false, error: 'Web Push disabled — configure VAPID keys on the server' };
  }

  const users = await User.find({ 'pushSubscriptions.0': { $exists: true } })
    .select('_id pushSubscriptions')
    .lean();

  const payload = buildTestPushPayload(overrides);
  let devices = 0;

  for (const user of users) {
    const targets = dedupePushSubscriptions(user.pushSubscriptions || []);
    if (!targets.length) continue;
    devices += targets.length;
    await sendPushToUser(user._id, payload);
  }

  return {
    ok: true,
    users: users.length,
    devices,
    notificationId: payload.notificationId,
    title: payload.title,
    body: payload.body,
  };
};

module.exports = {
  configureWebPush,
  sendPushToUser,
  broadcastTestPush,
  getVapidPublicKey: () => process.env.VAPID_PUBLIC_KEY || '',
};
