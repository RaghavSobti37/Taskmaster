const { ROOT_DOMAIN } = require('../../shared/emailStreams.cjs');
const {
  isVerifiedResendEmail,
  domainFromEmail,
} = require('./emailStreamUnsubscribe');

const VERIFIED_RESEND_DOMAIN = ROOT_DOMAIN;

const displayNameForResendEmail = (email) => {
  const key = (email || '').trim().toLowerCase();
  const labels = {
    'artist@theshakticollective.in': 'The Shakti Collective',
    'helloworld@theshakticollective.in': 'The Shakti Collective',
    'team@theshakticollective.in': 'The Shakti Collective',
    'artist@artist.theshakticollective.in': 'The Shakti Collective — Artist',
    'team@team.theshakticollective.in': 'The Shakti Collective — Team',
    'hello@events.theshakticollective.in': 'The Shakti Collective — Events',
  };
  if (labels[key]) return labels[key];
  const local = key.split('@')[0] || '';
  if (!local) return 'The Shakti Collective';
  return local.charAt(0).toUpperCase() + local.slice(1);
};

const resolveResendFromEmail = (campaign) => {
  const explicit = (campaign?.resendFromEmail || '').trim().toLowerCase();
  if (explicit && isVerifiedResendEmail(explicit)) return explicit;
  const linked = campaign?.senderProfileId && typeof campaign.senderProfileId === 'object'
    ? campaign.senderProfileId.email
    : null;
  if (linked && isVerifiedResendEmail(linked)) return linked.trim().toLowerCase();
  const envDefault = (process.env.SYSTEM_VERIFIED_FROM_EMAIL || '').trim().toLowerCase();
  if (envDefault && isVerifiedResendEmail(envDefault)) return envDefault;
  return envDefault || 'onboarding@resend.dev';
};

module.exports = {
  VERIFIED_RESEND_DOMAIN,
  ROOT_DOMAIN,
  isVerifiedResendEmail,
  domainFromEmail,
  displayNameForResendEmail,
  resolveResendFromEmail,
};
