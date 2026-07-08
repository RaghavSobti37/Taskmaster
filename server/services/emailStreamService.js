const { ROOT_DOMAIN, DEFAULT_EMAIL_STREAMS } = require('../../shared/emailStreams.cjs');
const { isVerifiedResendEmail } = require('../utils/emailStreamUnsubscribe');

const listActiveEmailStreams = async () => DEFAULT_EMAIL_STREAMS;

const resolveStreamForCampaign = async (campaign) => {
  const slug = String(campaign?.emailStreamSlug || 'main').toLowerCase();
  return DEFAULT_EMAIL_STREAMS.find((s) => s.slug === slug) || DEFAULT_EMAIL_STREAMS[0];
};

const validateFromEmailForStream = async (fromEmail, streamSlug) => {
  const from = String(fromEmail || '').trim().toLowerCase();
  if (!isVerifiedResendEmail(from)) {
    return { ok: false, error: `From address must use a verified Resend domain: @${ROOT_DOMAIN}` };
  }
  const slug = String(streamSlug || 'main').toLowerCase();
  const stream = DEFAULT_EMAIL_STREAMS.find((s) => s.slug === slug) || DEFAULT_EMAIL_STREAMS[0];
  const allowed = (stream.fromEmails || []).map((e) => e.toLowerCase());
  if (allowed.length && !allowed.includes(from)) {
    return { ok: false, error: 'From address not allowed for this email stream' };
  }
  return { ok: true, streamSlug: stream.slug, stream };
};

module.exports = {
  listActiveEmailStreams,
  resolveStreamForCampaign,
  validateFromEmailForStream,
};
