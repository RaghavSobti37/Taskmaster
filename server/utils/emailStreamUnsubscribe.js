const { ROOT_DOMAIN } = require('../../shared/emailStreams.cjs');

const isVerifiedResendEmail = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return false;
  const domain = addr.split('@')[1];
  if (domain === ROOT_DOMAIN) return true;
  return domain.endsWith(`.${ROOT_DOMAIN}`);
};

const domainFromEmail = (email) => (email || '').trim().toLowerCase().split('@')[1] || '';

const isBlockedForStreamSend = (leadDoc, streamSlug) => {
  if (!leadDoc) return false;
  if (leadDoc.unsubscribed || leadDoc.emailStatus === 'Unsubscribed') return true;
  if (leadDoc.emailStatus === 'Bounced' || leadDoc.emailStatus === 'Invalid') return true;
  const slug = String(streamSlug || 'main').toLowerCase();
  const rows = leadDoc.unsubscribedFrom || [];
  return rows.some((r) => String(r.slug || r.streamSlug || '').toLowerCase() === slug);
};

module.exports = {
  ROOT_DOMAIN,
  isVerifiedResendEmail,
  domainFromEmail,
  isBlockedForStreamSend,
};
