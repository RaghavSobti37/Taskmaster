/** Ops Hub domain taxonomy — shared by API and client hooks. */

const DOMAINS = [
  {
    key: 'academy',
    label: 'Academy',
    color: '#126d5e',
    subtypes: [
      { key: 'mentor', label: 'Mentor' },
      { key: 'partner', label: 'Partner' },
      { key: 'venue', label: 'Venue' },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    color: '#c45c26',
    subtypes: [
      { key: 'press', label: 'Press' },
      { key: 'creator', label: 'Creator' },
      { key: 'platform', label: 'Platform' },
    ],
  },
  {
    key: 'show_booking',
    label: 'Show Booking',
    color: '#5b4b8a',
    subtypes: [
      { key: 'promoter', label: 'Promoter' },
      { key: 'venue', label: 'Venue' },
      { key: 'agent', label: 'Agent' },
    ],
  },
  {
    key: 'influencers',
    label: 'Influencers',
    color: '#2a6f97',
    subtypes: [
      { key: 'macro', label: 'Macro' },
      { key: 'micro', label: 'Micro' },
      { key: 'brand', label: 'Brand' },
    ],
  },
];

const STATUSES = ['new', 'contacted', 'in_progress', 'nurturing', 'active', 'paused', 'closed'];

function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

module.exports = {
  DOMAINS,
  STATUSES,
  getWeekKey,
};
