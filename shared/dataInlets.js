/**
 * Data Hub inlet taxonomy — single config for folder labels and keys.
 */

const DATA_INLETS = {
  all: { key: 'all', label: 'All People', icon: 'database' },
  exly: { key: 'exly', label: 'Exly', icon: 'shopping-bag' },
  leads: { key: 'leads', label: 'Leads', icon: 'users' },
  outsourced: { key: 'outsourced', label: 'Outsourced Data', icon: 'sheet' },
  tsc: { key: 'outsourced', label: 'Outsourced Data', icon: 'sheet' },
  newsletter: { key: 'newsletter', label: 'Newsletter', icon: 'mail' },
  artist_path: { key: 'artist_path', label: 'Artist Path', icon: 'music' },
  booked_calls: { key: 'booked_calls', label: 'Booked Calls', icon: 'phone' },
  enquiries: { key: 'enquiries', label: 'Enquiries', icon: 'message-square' },
  unsubscribed: { key: 'unsubscribed', label: 'Unsubscribed', icon: 'user-x' },
  mail: { key: 'mail', label: 'Mail Engagement', icon: 'mail' },
  community: { key: 'community', label: 'Community', icon: 'users-round' },
  active: { key: 'active', label: 'Active Users', icon: 'activity' },
  loyal: { key: 'loyal', label: 'Loyal Customers', icon: 'star' },
};

const INLET_KEYS = Object.keys(DATA_INLETS).filter((k) => k !== 'all' && k !== 'loyal' && k !== 'tsc');

const BOOKED_CALL_SOURCE_RE = /website booking|booked call|discovery call|booked discovery/i;

const COMMUNITY_RE = /community/i;

/** Map legacy ContactService source param to inlet key */
const SOURCE_TO_INLET = {
  crm: 'leads',
  exly: 'exly',
  mailer: 'mail',
  tsc: 'outsourced',
  outsourced: 'outsourced',
  newsletter: 'newsletter',
  artist_path: 'artist_path',
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

/** Merge duplicate inlet keys on a contact (legacy data may have repeats). */
function dedupeInletEntries(inlets = []) {
  const map = new Map();
  for (const inlet of inlets) {
    if (!inlet?.key) continue;
    const existing = map.get(inlet.key);
    if (!existing) {
      map.set(inlet.key, {
        ...inlet,
        recordIds: [...(inlet.recordIds || [])],
      });
      continue;
    }
    const idSet = new Set([
      ...(existing.recordIds || []).map(String),
      ...(inlet.recordIds || []).map(String),
    ]);
    existing.recordIds = [...idSet];
    if (inlet.lastSeenAt && (!existing.lastSeenAt || new Date(inlet.lastSeenAt) > new Date(existing.lastSeenAt))) {
      existing.lastSeenAt = inlet.lastSeenAt;
    }
    if (inlet.firstSeenAt && (!existing.firstSeenAt || new Date(inlet.firstSeenAt) < new Date(existing.firstSeenAt))) {
      existing.firstSeenAt = inlet.firstSeenAt;
    }
    existing.summary = { ...(existing.summary || {}), ...(inlet.summary || {}) };
    map.set(inlet.key, existing);
  }
  return [...map.values()];
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
  dedupeInletEntries,
};
