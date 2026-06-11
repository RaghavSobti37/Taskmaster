/**
 * Collection sets for prod → local sync modes.
 * Mongo collection names are lowercase plural (Mongoose default).
 */

/** CRM / Data Hub spine — excluded from operational local sync */
const CRM_DATAHUB_EXCLUDE = [
  'leads',
  'personindexes',
  'personhubviews',
  'persons',
  'personidentifiers',
  'personcommunicationprofiles',
  'personsourcelinks',
  'people',
  'crmimports',
  'crmstatsnapshots',
  'datahubsyncstates',
  'contacts',
  'outsourcedrecords',
  'exlybookings',
  'bookedcalls',
  'newslettersubscribers',
  'artistpathresponses',
  'tscdatas',
  'mailevents',
  'emaillogs',
  'mailcampaigns',
  'mailtemplates',
];

const CRM_DATAHUB_EXCLUDE_SET = new Set(
  CRM_DATAHUB_EXCLUDE.map((n) => n.toLowerCase())
);

/** Core operational data — always copied in operational mode */
const OPERATIONAL_INCLUDE = [
  'users',
  'departments',
  'projects',
  'tasks',
  'taskassignments',
  'teams',
  'workspaces',
  'platformsettings',
  'tasktypes',
  'phases',
  'tenants',
  'subscriptions',
  'officecontacts',
  'officeassets',
  'announcements',
  'navbarpreferences',
  'workspacepreferences',
  'shortcutpreferences',
  'dashboardpresets',
  'gamificationconfigs',
];

const OPERATIONAL_INCLUDE_SET = new Set(
  OPERATIONAL_INCLUDE.map((n) => n.toLowerCase())
);

/**
 * @param {'full'|'operational'} mode
 * @param {string[]} prodCollectionNames
 * @param {string[]} [extraExclude]
 */
function resolveCollectionsToSync(mode, prodCollectionNames, extraExclude = []) {
  const extra = new Set(extraExclude.map((n) => n.toLowerCase()));
  const names = prodCollectionNames.filter((n) => !n.startsWith('system.'));

  if (mode === 'full') {
    return names.filter((n) => !extra.has(n.toLowerCase()));
  }

  return names.filter((name) => {
    const key = name.toLowerCase();
    if (extra.has(key)) return false;
    if (CRM_DATAHUB_EXCLUDE_SET.has(key)) return false;
    return true;
  });
}

/**
 * Collections to drop on local after operational sync (stale CRM/DH from prior full sync).
 */
function getCrmDataHubCollectionNames() {
  return [...CRM_DATAHUB_EXCLUDE_SET];
}

function parseSyncMode(argv = process.argv) {
  const modeArg = argv.find((a) => a.startsWith('--mode='));
  if (modeArg) {
    const mode = modeArg.split('=')[1].trim().toLowerCase();
    if (mode === 'operational' || mode === 'full') return mode;
    throw new Error(`Invalid --mode=${mode}. Use operational or full.`);
  }
  const envMode = String(process.env.SYNC_MODE || 'full').trim().toLowerCase();
  if (envMode === 'operational' || envMode === 'full') return envMode;
  return 'full';
}

function parseExcludeList(argv = process.argv) {
  const excludeArg = argv.find((a) => a.startsWith('--exclude='));
  if (!excludeArg) return [];
  return excludeArg
    .split('=')[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  CRM_DATAHUB_EXCLUDE,
  CRM_DATAHUB_EXCLUDE_SET,
  OPERATIONAL_INCLUDE,
  OPERATIONAL_INCLUDE_SET,
  resolveCollectionsToSync,
  getCrmDataHubCollectionNames,
  parseSyncMode,
  parseExcludeList,
};
