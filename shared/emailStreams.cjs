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

module.exports = {
  ROOT_DOMAIN,
  DEFAULT_EMAIL_STREAMS,
};
