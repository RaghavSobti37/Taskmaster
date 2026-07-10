/**
 * Data Hub inlet taxonomy — single config for folder labels and keys.
 */

const DATA_INLETS = {
  all: { key: 'all', label: 'All People', icon: 'database' },
  event_artist: { key: 'event_artist', label: 'Event and Artist Data', icon: 'calendar' },
  exly: { key: 'exly', label: 'Exly', icon: 'shopping-bag' },
  leads: { key: 'leads', label: 'Leads', icon: 'users' },
  outsourced: { key: 'outsourced', label: 'Outsourced Data', icon: 'sheet' },
  tsc: { key: 'outsourced', label: 'Outsourced Data', icon: 'sheet' },
  newsletter: { key: 'newsletter', label: 'Newsletter', icon: 'mail' },
  artist_path: { key: 'artist_path', label: 'Artist Path', icon: 'music' },
  artist_crm: { key: 'artist_crm', label: 'Artist CRM', icon: 'music' },
  booked_calls: { key: 'booked_calls', label: 'Booked Calls', icon: 'phone' },
  enquiries: { key: 'enquiries', label: 'Enquiries', icon: 'message-square' },
  unsubscribed: { key: 'unsubscribed', label: 'Unsubscribed', icon: 'user-x' },
  mail: { key: 'mail', label: 'Mail Engagement', icon: 'mail' },
  media: { key: 'media', label: 'Media Data', icon: 'film' },
  mailchimp: { key: 'mailchimp', label: 'Mailchimp', icon: 'users' },
  hubspot: { key: 'hubspot', label: 'HubSpot', icon: 'building' },
  media_pr: { key: 'media_pr', label: 'Media PR', icon: 'newspaper' },
  media_journalist: { key: 'media_journalist', label: 'Media Journalists', icon: 'mic' },
  media_influencer: { key: 'media_influencer', label: 'Media Influencers', icon: 'megaphone' },
  academy_students: { key: 'academy_students', label: 'Academy Students', icon: 'graduation-cap' },
  havells_registered: { key: 'havells_registered', label: 'Havells Participants', icon: 'users' },
  havells_selected: { key: 'havells_selected', label: 'Havells Selected', icon: 'check-circle' },
  havells_attended_delhi: { key: 'havells_attended_delhi', label: 'Havells Attended Delhi', icon: 'map-pin' },
  havells_attended_indore: { key: 'havells_attended_indore', label: 'Havells Attended Indore', icon: 'map-pin' },
  havells_attended_dumka: { key: 'havells_attended_dumka', label: 'Havells Attended Dumka', icon: 'map-pin' },
  webhook_in: { key: 'webhook_in', label: 'Inbound Webhooks', icon: 'webhook' },
  website_form: { key: 'website_form', label: 'Website Forms', icon: 'globe' },
  community: { key: 'community', label: 'Community', icon: 'users-round' },
  active: { key: 'active', label: 'Active Users', icon: 'activity' },
  loyal: { key: 'loyal', label: 'Loyal Customers', icon: 'star' },
};

const INLET_KEYS = Object.keys(DATA_INLETS).filter((k) => k !== 'all' && k !== 'loyal' && k !== 'tsc');

const DATA_INLET_GROUPS = [
  { key: 'all', label: 'All', inlets: ['all'] },
  {
    key: 'event_artist',
    label: 'Event and Artist Data',
    inlets: ['event_artist', 'leads', 'artist_path', 'artist_crm', 'booked_calls', 'enquiries'],
  },
  {
    key: 'media',
    label: 'Media Data',
    inlets: ['media', 'media_pr', 'media_journalist', 'media_influencer', 'mailchimp', 'hubspot', 'mail'],
  },
  { key: 'academy', label: 'Academy Students', inlets: ['academy_students'] },
  {
    key: 'havells',
    label: 'Havells Participants',
    inlets: ['havells_registered', 'havells_selected', 'havells_attended_delhi', 'havells_attended_indore', 'havells_attended_dumka'],
  },
  { key: 'newsletter', label: 'Newsletter', inlets: ['newsletter', 'unsubscribed'] },
  { key: 'ops', label: 'Other Operational', inlets: ['outsourced', 'community', 'webhook_in', 'website_form', 'exly', 'active', 'loyal'] },
];

const BOOKED_CALL_SOURCE_RE = /website booking|booked call|discovery call|booked discovery|website artist enquiry|artist booking enquiry/i;

const COMMUNITY_RE = /community/i;

/** Map legacy ContactService source param to inlet key */
const SOURCE_TO_INLET = {
  crm: 'leads',
  exly: 'exly',
  mailer: 'mail',
  mailchimp: 'mailchimp',
  hubspot: 'hubspot',
  webhook_in: 'webhook_in',
  tsc: 'outsourced',
  outsourced: 'outsourced',
  newsletter: 'newsletter',
  artist_path: 'artist_path',
  artist_crm: 'artist_crm',
  booked_calls: 'booked_calls',
  enquiries: 'enquiries',
  havells_registered: 'havells_registered',
  havells_selected: 'havells_selected',
  havells_attended_delhi: 'havells_attended_delhi',
  havells_attended_indore: 'havells_attended_indore',
  havells_attended_dumka: 'havells_attended_dumka',
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

function buildInletGroups(counts = {}) {
  return DATA_INLET_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    total: group.inlets.reduce((sum, key) => sum + Number(counts[key] || 0), 0),
    inlets: group.inlets.map((key) => ({
      key,
      label: DATA_INLETS[key]?.label || key,
      count: Number(counts[key] || 0),
    })),
  }));
}

module.exports = {
  DATA_INLETS,
  INLET_KEYS,
  DATA_INLET_GROUPS,
  BOOKED_CALL_SOURCE_RE,
  COMMUNITY_RE,
  SOURCE_TO_INLET,
  buildInletGroups,
  inletLabel,
  isBookedCallSource,
  isCommunityText,
  dedupeInletEntries,
};
