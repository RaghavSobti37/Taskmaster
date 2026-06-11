const {
  resolveCollectionsToSync,
  CRM_DATAHUB_EXCLUDE_SET,
  parseSyncMode,
} = require('../config/syncCollections');
const { isDataHubReconcileEnabled } = require('../utils/dataHubFlags');

describe('syncCollections', () => {
  const prodNames = [
    'users',
    'projects',
    'leads',
    'personindexes',
    'tasks',
    'mailcampaigns',
  ];

  test('full mode copies all collections', () => {
    const result = resolveCollectionsToSync('full', prodNames);
    expect(result).toHaveLength(prodNames.length);
  });

  test('operational mode skips CRM/Data Hub collections', () => {
    const result = resolveCollectionsToSync('operational', prodNames);
    expect(result).toEqual(['users', 'projects', 'tasks']);
    expect(CRM_DATAHUB_EXCLUDE_SET.has('leads')).toBe(true);
  });

  test('parseSyncMode reads argv', () => {
    expect(parseSyncMode(['node', 'script', '--mode=operational'])).toBe('operational');
  });
});

describe('dataHubFlags', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    jest.resetModules();
  });

  test('reconcile disabled when env false', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATA_HUB_RECONCILE_ENABLED = 'false';
    jest.resetModules();
    const { isDataHubReconcileEnabled: check } = require('../utils/dataHubFlags');
    expect(check()).toBe(false);
  });

  test('reconcile enabled in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATA_HUB_RECONCILE_ENABLED;
    jest.resetModules();
    const { isDataHubReconcileEnabled: check } = require('../utils/dataHubFlags');
    expect(check()).toBe(true);
  });
});
