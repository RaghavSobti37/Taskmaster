const {
  ROOT_DOMAIN,
  isVerifiedResendEmail,
  DEFAULT_EMAIL_STREAMS,
} = require('../../shared/emailStreams.cjs');

const DEFAULT_SENDER = 'team@theshakticollective.in';

const displayNameForResendEmail = (email) => {
  const key = (email || '').trim().toLowerCase();
  const labels = {
    'artist@theshakticollective.in': 'The Shakti Collective',
    'helloworld@theshakticollective.in': 'The Shakti Collective',
    'team@theshakticollective.in': 'The Shakti Collective',
    'hello@theshakticollective.in': 'The Shakti Collective — Events',
  };
  if (labels[key]) return labels[key];
  const local = key.split('@')[0] || '';
  if (!local) return 'The Shakti Collective';
  return local.charAt(0).toUpperCase() + local.slice(1);
};

/** Map team@team.domain to team@domain for legacy campaign sender fields. */
const coerceVerifiedSender = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return null;
  if (isVerifiedResendEmail(addr)) return addr;
  const [local, domain] = addr.split('@');
  if (domain.endsWith(`.${ROOT_DOMAIN}`)) {
    const rootCandidate = `${local}@${ROOT_DOMAIN}`;
    if (isVerifiedResendEmail(rootCandidate)) return rootCandidate;
  }
  return null;
};

const resolveResendFromEmail = (campaign) => {
  const explicit = coerceVerifiedSender(campaign?.resendFromEmail);
  if (explicit) return explicit;

  const profile = campaign?.senderProfileId;
  const linked = profile && typeof profile === 'object' ? profile.email : null;
  const fromProfile = coerceVerifiedSender(linked);
  if (fromProfile) return fromProfile;

  const envDefault = coerceVerifiedSender(process.env.SYSTEM_VERIFIED_FROM_EMAIL);
  if (envDefault) return envDefault;

  return DEFAULT_SENDER;
};

module.exports = {
  VERIFIED_RESEND_DOMAIN: ROOT_DOMAIN,
  isVerifiedResendEmail,
  displayNameForResendEmail,
  resolveResendFromEmail,
};
