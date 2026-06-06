const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const ContactService = require('./ContactService');
const { sanitizeEmail } = require('../utils/sanitizer');

async function processNewsletterWebhook(data = {}) {
  const email = sanitizeEmail(data.email);
  if (!email) {
    throw new Error('Missing required field: email');
  }

  const source = data.source || 'tsc-footer';
  const sourceSite = data.sourceSite || 'tsc-website';
  const subscribedAt = data.subscribedAt ? new Date(data.subscribedAt) : new Date();
  const name = data.name || email.split('@')[0] || 'Newsletter Subscriber';

  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        name,
        source,
        subscribedAt,
        unsubscribed: false,
        metadata: { sourceSite, ...(data.metadata || {}) },
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  await ContactService.mergeContact({
    name,
    email,
    recordId: subscriber._id,
    summary: { source, sourceSite },
    inletKey: 'newsletter',
  }, 'newsletter');

  return { success: true, subscriberId: subscriber._id };
}

module.exports = { processNewsletterWebhook };
