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
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(idx);
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

module.exports = { configureWebPush, sendPushToUser, getVapidPublicKey: () => process.env.VAPID_PUBLIC_KEY || '' };
