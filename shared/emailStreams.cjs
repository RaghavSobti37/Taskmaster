/** Shared email stream catalog — branded from-addresses per stream. */
const ROOT_DOMAIN = 'theshakticollective.in';

const DEFAULT_EMAIL_STREAMS = [
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
    fromEmails: ['artist@artist.theshakticollective.in'],
    unsubscribeSlug: 'artist',
  },
  {
    slug: 'team',
    label: 'Team',
    fromEmails: ['team@team.theshakticollective.in'],
    unsubscribeSlug: 'team',
  },
  {
    slug: 'events',
    label: 'Events',
    fromEmails: ['hello@events.theshakticollective.in'],
    unsubscribeSlug: 'events',
  },
];

const domainForSlug = (slug) => (slug === 'main' ? ROOT_DOMAIN : `${slug}.${ROOT_DOMAIN}`);

/** API/UI shape — picker expects name, domain, defaultFromEmail */
const normalizeEmailStream = (stream, index = 0) => {
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

const listEmailStreamsForApi = () => DEFAULT_EMAIL_STREAMS.map((s, i) => normalizeEmailStream(s, i));

module.exports = {
  ROOT_DOMAIN,
  DEFAULT_EMAIL_STREAMS,
  domainForSlug,
  normalizeEmailStream,
  listEmailStreamsForApi,
};
