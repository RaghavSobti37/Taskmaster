const {
  ROOT_DOMAIN,
  domainFromEmail,
  isVerifiedResendEmail,
} = require('../../shared/emailStreams.cjs');

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
