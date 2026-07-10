/** Browser/ESM facade for the shared email stream catalog. Keep in sync with emailStreams.cjs. */
export const ROOT_DOMAIN = 'theshakticollective.in';
export const RESEND_VERIFIED_DOMAINS = [ROOT_DOMAIN];

export const domainFromEmail = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';

export const isVerifiedResendDomain = (domain) =>
  RESEND_VERIFIED_DOMAINS.includes(String(domain || '').trim().toLowerCase());

export const isVerifiedResendEmail = (email) => {
  const addr = String(email || '').trim().toLowerCase();
  if (!addr.includes('@')) return false;
  return isVerifiedResendDomain(domainFromEmail(addr));
};

export const DEFAULT_EMAIL_STREAMS = [
  {
    slug: 'main',
    label: 'Main',
    fromEmails: [
      'artist@theshakticollective.in',
      'helloworld@theshakticollective.in',
      'team@theshakticollective.in',
    ],
    unsubscribeSlug: 'main',
  },
  {
    slug: 'artist',
    label: 'Artist',
    domain: ROOT_DOMAIN,
    fromEmails: ['artist@theshakticollective.in'],
    unsubscribeSlug: 'artist',
  },
  {
    slug: 'team',
    label: 'Team',
    domain: ROOT_DOMAIN,
    fromEmails: ['team@theshakticollective.in'],
    unsubscribeSlug: 'team',
  },
  {
    slug: 'events',
    label: 'Events',
    domain: ROOT_DOMAIN,
    fromEmails: ['hello@theshakticollective.in'],
    unsubscribeSlug: 'events',
  },
];

export const domainForSlug = (slug) => (slug === 'main' ? ROOT_DOMAIN : `${slug}.${ROOT_DOMAIN}`);

export const normalizeEmailStream = (stream, index = 0) => {
  if (!stream?.slug) return null;
  const fromEmails = Array.isArray(stream.fromEmails) ? stream.fromEmails : [];
  const slug = String(stream.slug).toLowerCase();
  return {
    slug,
    name: stream.name || stream.label || slug,
    label: stream.label || stream.name || slug,
    domain: stream.domain || domainForSlug(slug),
    fromEmails,
    defaultFromEmail: stream.defaultFromEmail || fromEmails[0] || '',
    unsubscribeSlug: stream.unsubscribeSlug || slug,
    isActive: stream.isActive !== false,
    isDefault: stream.isDefault === true || slug === 'main',
    sortOrder: stream.sortOrder ?? index,
  };
};

export const listEmailStreamsForApi = () => DEFAULT_EMAIL_STREAMS.map((s, i) => normalizeEmailStream(s, i));
