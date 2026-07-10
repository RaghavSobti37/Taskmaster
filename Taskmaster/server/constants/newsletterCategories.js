const NEWSLETTER_ARTICLE_CATEGORIES = [
  { key: 'industry', label: 'Industry news' },
  { key: 'tsc', label: 'TSC / Collective updates' },
  { key: 'artist_tips', label: 'Artist tips & resources' },
  { key: 'events', label: 'Events & offerings' },
  { key: 'other', label: 'Other' },
];

const CATEGORY_KEYS = NEWSLETTER_ARTICLE_CATEGORIES.map((c) => c.key);

const categoryLabel = (key) => NEWSLETTER_ARTICLE_CATEGORIES.find((c) => c.key === key)?.label || key;

module.exports = {
  NEWSLETTER_ARTICLE_CATEGORIES,
  CATEGORY_KEYS,
  categoryLabel,
};
