const VERIFIED_RESEND_DOMAIN = 'theshakticollective.in';

const isVerifiedResendEmail = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return false;
  return new RegExp(`^[a-z0-9._%+-]+@${VERIFIED_RESEND_DOMAIN.replace('.', '\\.')}$`, 'i').test(addr);
};

const displayNameForResendEmail = (email) => {
  const key = (email || '').trim().toLowerCase();
  const labels = {
    'artist@theshakticollective.in': 'The Shakti Collective',
    'helloworld@theshakticollective.in': 'The Shakti Collective',
    'team@theshakticollective.in': 'The Shakti Collective',
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
  isVerifiedResendEmail,
  displayNameForResendEmail,
  resolveResendFromEmail,
};
