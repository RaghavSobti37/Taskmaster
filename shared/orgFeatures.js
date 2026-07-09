/** ESM entry — keep in sync with orgFeatures.cjs */

export const ORG_FEATURE_KEYS = [
  'resend',
  'google',
  'meta',
  'finance',
  'artistOs',
  'integrations',
  'opsHub',
  'enterpriseApi',
];

export const ORG_FEATURE_CATALOG = {
  resend: {
    label: 'Email campaigns',
    description: 'Campaigns, templates, streams, and email analytics.',
    defaultOnCreate: false,
    gatedPaths: [],
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
  enterpriseApi: {
    label: 'Enterprise API',
    description: 'Enterprise developer settings and API access.',
    defaultOnCreate: false,
    gatedPaths: ['/developers'],
  },
};

export function defaultFeatureUnlocks() {
  return Object.fromEntries(
    ORG_FEATURE_KEYS.map((key) => [key, Boolean(ORG_FEATURE_CATALOG[key]?.defaultOnCreate)]),
  );
}

export function normalizeFeatureUnlocks(input = {}) {
  const out = defaultFeatureUnlocks();
  if (!input || typeof input !== 'object') return out;
  for (const key of ORG_FEATURE_KEYS) {
    if (input[key] !== undefined) out[key] = Boolean(input[key]);
  }
  return out;
}

export function isValidFeatureKey(key) {
  return ORG_FEATURE_KEYS.includes(key);
}
