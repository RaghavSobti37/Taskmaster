/**
 * Data Hub inlet taxonomy — single config for folder labels and keys.
 */

const DATA_INLETS = {
  all: { key: 'all', label: 'All People', icon: 'database' },
  exly: { key: 'exly', label: 'Exly', icon: 'shopping-bag' },
  leads: { key: 'leads', label: 'Leads', icon: 'users' },
  tsc: { key: 'tsc', label: 'TSC / HolySheet', icon: 'sheet' },
  booked_calls: { key: 'booked_calls', label: 'Booked Calls', icon: 'phone' },
  enquiries: { key: 'enquiries', label: 'Enquiries', icon: 'message-square' },
  unsubscribed: { key: 'unsubscribed', label: 'Unsubscribed', icon: 'user-x' },
  mail: { key: 'mail', label: 'Mail Engagement', icon: 'mail' },
  community: { key: 'community', label: 'Community', icon: 'users-round' },
  active: { key: 'active', label: 'Active Users', icon: 'activity' },
  loyal: { key: 'loyal', label: 'Loyal Customers', icon: 'star' },
};

const INLET_KEYS = Object.keys(DATA_INLETS).filter((k) => k !== 'all' && k !== 'loyal');

const BOOKED_CALL_SOURCE_RE = /website booking|booked call|discovery call|booked discovery/i;

const COMMUNITY_RE = /community/i;

/** Map legacy ContactService source param to inlet key */
const SOURCE_TO_INLET = {
  crm: 'leads',
  exly: 'exly',
  mailer: 'mail',
  tsc: 'tsc',
  booked_calls: 'booked_calls',
  enquiries: 'enquiries',
};

function inletLabel(key) {
  return DATA_INLETS[key]?.label || key;
}

function isBookedCallSource(source) {
  return BOOKED_CALL_SOURCE_RE.test(String(source || ''));
}

function isCommunityText(text) {
  return COMMUNITY_RE.test(String(text || ''));
}

module.exports = {
  DATA_INLETS,
  INLET_KEYS,
  BOOKED_CALL_SOURCE_RE,
  COMMUNITY_RE,
  SOURCE_TO_INLET,
  inletLabel,
  isBookedCallSource,
  isCommunityText,
};
