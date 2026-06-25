/**
 * Canonical Google Sheet tab → assignee mapping for artist CRM imports.
 * Business rules override suffix names on sheet titles (e.g. "Maharashtra Colleges - Harshika" → Akash).
 */

const ASSIGNEE_KEYS = {
  AKASH: 'akash',
  ROHITH: 'rohith',
  HARSHIKA: 'harshika',
  DEEPANK: 'deepank',
  ATHARVA: 'atharva',
};

/** First matching rule wins — keep more specific patterns above broader ones. */
const SHEET_ASSIGNEE_RULES = [
  {
    key: 'awards_summits',
    label: 'Awards & Summits',
    sheetPatterns: [/awards\s*&\s*summits/i],
    assigneeKey: ASSIGNEE_KEYS.HARSHIKA,
  },
  {
    key: 'maharashtra_colleges',
    label: 'Maharashtra Colleges',
    sheetPatterns: [/maharashtra\s*colleges/i],
    assigneeKey: ASSIGNEE_KEYS.AKASH,
  },
  {
    key: 'private_shows',
    label: 'Private Shows',
    sheetPatterns: [/private\s*shows/i],
    assigneeKey: ASSIGNEE_KEYS.DEEPANK,
  },
  {
    key: 'yugm_kabir',
    label: 'YUGM Kabir Cafe Performance',
    sheetPatterns: [/for\s*yugm.*kabir/i, /yugm.*kabir\s*cafe/i, /kabir\s*cafe\s*perform/i],
    assigneeKey: ASSIGNEE_KEYS.HARSHIKA,
  },
  {
    key: 'yugm_parvaaz_agni',
    label: 'YUGM Parvaaz / Agni',
    sheetPatterns: [
      /kabir\s*cafe.*agnee/i,
      /agnee.*parvaaz/i,
      /parvaaz\s*data/i,
      /yugm.*parvaaz/i,
      /yugm.*agni/i,
    ],
    assigneeKey: ASSIGNEE_KEYS.ROHITH,
  },
  {
    key: 'iccr',
    label: 'ICCR',
    sheetPatterns: [/^iccr\b/i, /\biccr[\s/-]/i],
    assigneeKey: ASSIGNEE_KEYS.AKASH,
  },
  {
    key: 'event_mgmt',
    label: 'Event Management Companies',
    sheetPatterns: [/event\s*management\s*companies/i],
    assigneeKey: ASSIGNEE_KEYS.DEEPANK,
  },
  {
    key: 'nashik_sponsors',
    label: 'Nashik City Sponsors',
    sheetPatterns: [/nashik\s*city/i],
    assigneeKey: ASSIGNEE_KEYS.AKASH,
  },
  {
    key: 'govt_cultural',
    label: 'Govt. Cultural Secretaries',
    sheetPatterns: [/govt\.?\s*cultural/i],
    assigneeKey: ASSIGNEE_KEYS.ROHITH,
  },
  {
    key: 'venues',
    label: 'Venues',
    sheetPatterns: [/live\s*gig\s*venue/i, /music\s*event\s*venues/i, /\bvenues\b/i],
    assigneeKey: ASSIGNEE_KEYS.DEEPANK,
  },
  {
    key: 'fests',
    label: 'Fests',
    sheetPatterns: [/music\s*festivals/i, /art\s*festivals/i, /\bfests\b/i],
    assigneeKey: ASSIGNEE_KEYS.HARSHIKA,
  },
  {
    key: 'storytelling',
    label: 'Storytelling Events',
    sheetPatterns: [/storytelling/i],
    assigneeKey: ASSIGNEE_KEYS.DEEPANK,
  },
  {
    key: 'brands_music',
    label: 'Brands for Music Collabs',
    sheetPatterns: [/brands\s*for\s*music/i],
    assigneeKey: ASSIGNEE_KEYS.HARSHIKA,
  },
  {
    key: 'colleges_artists',
    label: 'Colleges for Artists',
    sheetPatterns: [/colleges\s*for\s*artist/i],
    assigneeKey: ASSIGNEE_KEYS.HARSHIKA,
  },
];

/** Known sheet tab titles from the master Google Sheet (for CRM filters). */
const KNOWN_IMPORT_SHEETS = [
  { sheetName: 'Awards & Summits', ruleKey: 'awards_summits' },
  { sheetName: 'Maharashtra Colleges - Harshika', ruleKey: 'maharashtra_colleges' },
  { sheetName: 'Private Shows - Akash', ruleKey: 'private_shows' },
  { sheetName: 'For YUGM- Kabir Cafe Performace data - harshika', ruleKey: 'yugm_kabir' },
  { sheetName: 'Kabir Cafe, Agnee, Parvaaz data - RS', ruleKey: 'yugm_parvaaz_agni' },
  { sheetName: 'ICCR- State Govt. Contact Details - RS', ruleKey: 'iccr' },
  { sheetName: 'Event Management Companies - Deepank Soni', ruleKey: 'event_mgmt' },
  { sheetName: 'nashik city Sponcer - Akash & Harshika', ruleKey: 'nashik_sponsors' },
  { sheetName: 'Govt. Cultural Department - RS', ruleKey: 'govt_cultural' },
  { sheetName: 'Live Gig Venue - Deepank', ruleKey: 'venues' },
  { sheetName: 'Music Event Venues - Deepank', ruleKey: 'venues' },
  { sheetName: 'Music Festivals - Harshika', ruleKey: 'fests' },
  { sheetName: 'Art Festivals - Harshika', ruleKey: 'fests' },
  { sheetName: 'Storytelling Events- Deepank', ruleKey: 'storytelling' },
  { sheetName: 'Brands for Music Collaborations - Harshika', ruleKey: 'brands_music' },
  { sheetName: 'Colleges for Artist Performances - Harshika', ruleKey: 'colleges_artists' },
];

const ASSIGNEE_KEY_PATTERNS = {
  [ASSIGNEE_KEYS.AKASH]: [/akash/i],
  [ASSIGNEE_KEYS.ROHITH]: [/rohith/i],
  [ASSIGNEE_KEYS.HARSHIKA]: [/harshika/i],
  [ASSIGNEE_KEYS.DEEPANK]: [/deepank/i],
  [ASSIGNEE_KEYS.ATHARVA]: [/atharva/i],
};

function normalizeSheetLabel(sheetName) {
  return String(sheetName || '').replace(/\.csv$/i, '').trim();
}

function resolveAssigneeKeyFromSheetName(sheetName) {
  const label = normalizeSheetLabel(sheetName);
  if (!label) return null;

  for (const rule of SHEET_ASSIGNEE_RULES) {
    if (rule.sheetPatterns.some((re) => re.test(label))) {
      return {
        assigneeKey: rule.assigneeKey,
        ruleKey: rule.key,
        ruleLabel: rule.label,
        source: 'sheet_rule',
        sheetName: label,
      };
    }
  }
  return null;
}

function googleSheetSourceForTab(sheetName) {
  return `Google Sheet: ${normalizeSheetLabel(sheetName)}`;
}

function listImportSheetFilters() {
  return KNOWN_IMPORT_SHEETS.map((entry) => {
    const rule = SHEET_ASSIGNEE_RULES.find((r) => r.key === entry.ruleKey);
    return {
      sheetName: entry.sheetName,
      source: googleSheetSourceForTab(entry.sheetName),
      label: rule?.label || entry.sheetName,
      ruleKey: entry.ruleKey,
      assigneeKey: rule?.assigneeKey || null,
    };
  });
}

module.exports = {
  ASSIGNEE_KEYS,
  ASSIGNEE_KEY_PATTERNS,
  SHEET_ASSIGNEE_RULES,
  KNOWN_IMPORT_SHEETS,
  normalizeSheetLabel,
  resolveAssigneeKeyFromSheetName,
  googleSheetSourceForTab,
  listImportSheetFilters,
};
