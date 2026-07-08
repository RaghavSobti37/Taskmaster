/** Per-org optional feature modules — keep in sync with orgFeatures.js */

const ORG_FEATURE_KEYS = [
  'resend',
  'google',
  'meta',
  'finance',
  'artistOs',
  'integrations',
  'opsHub',
  'dataHub',
  'enterpriseApi',
];

const ORG_FEATURE_CATALOG = {
  resend: {
    label: 'Email campaigns',
    description: 'Campaigns, templates, streams, and email analytics.',
    defaultOnCreate: false,
    gatedPaths: ['/emails', '/campaign'],
  },
  google: {
    label: 'Google integrations',
    description: 'Google OAuth and workspace integrations.',
    defaultOnCreate: false,
    gatedPaths: [],
  },
  meta: {
    label: 'Meta integrations',
    description: 'Meta ads and social integrations.',
    defaultOnCreate: false,
    gatedPaths: [],
  },
  finance: {
    label: 'Finance',
    description: 'Invoices, approvals, and finance reporting.',
    defaultOnCreate: false,
    gatedPaths: ['/finance', '/management'],
  },
  artistOs: {
    label: 'Artist OS',
    description: 'Artist roster, workspaces, and portfolio tools.',
    defaultOnCreate: false,
    gatedPaths: ['/artists', '/management'],
  },
  integrations: {
    label: 'Integrations hub',
    description: 'Third-party connectors and inbound webhooks.',
    defaultOnCreate: false,
    gatedPaths: ['/developers'],
  },
  opsHub: {
    label: 'Ops Hub',
    description: 'Operations hub tools and workflows.',
    defaultOnCreate: false,
    gatedPaths: ['/admin/ops-hub'],
  },
  dataHub: {
    label: 'Data Hub',
    description: 'Data hub admin surface and records.',
    defaultOnCreate: true,
    gatedPaths: ['/admin', '/data-hub'],
  },
  enterpriseApi: {
    label: 'Enterprise API',
    description: 'Enterprise developer settings and API access.',
    defaultOnCreate: false,
    gatedPaths: ['/developers'],
  },
};

function defaultFeatureUnlocks() {
  return Object.fromEntries(
    ORG_FEATURE_KEYS.map((key) => [key, Boolean(ORG_FEATURE_CATALOG[key]?.defaultOnCreate)]),
  );
}

function allFeatureUnlocks() {
  return Object.fromEntries(ORG_FEATURE_KEYS.map((key) => [key, true]));
}

function normalizeFeatureUnlocks(input = {}) {
  const out = defaultFeatureUnlocks();
  if (!input || typeof input !== 'object') return out;
  for (const key of ORG_FEATURE_KEYS) {
    if (input[key] !== undefined) out[key] = Boolean(input[key]);
  }
  return out;
}

function isValidFeatureKey(key) {
  return ORG_FEATURE_KEYS.includes(key);
}

module.exports = {
  ORG_FEATURE_KEYS,
  ORG_FEATURE_CATALOG,
  defaultFeatureUnlocks,
  allFeatureUnlocks,
  normalizeFeatureUnlocks,
  isValidFeatureKey,
};
