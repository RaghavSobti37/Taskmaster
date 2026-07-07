const DataHubService = require('../../../services/DataHubService');
const { getDataHubRuntimeFlags, isDataHubReconcileEnabled } = require('../../../utils/dataHubFlags');
const {
  runDailyBackup,
  listAvailableBackups,
  getBackupDestination,
  getBackupProgress,
} = require('../../../services/databaseBackupService');
const { notifyBackupResult } = require('../../../services/backupNotificationService');
const logger = require('../../../utils/logger');
const { getCache, setCache } = require('../../../services/cacheService');
const {
  importAisensyCampaignCsv,
  listCampaignSummaries,
  inferCampaignNameFromFilename,
  inferStatusFromFilename,
} = require('../../../services/aisensyCampaignImportService');
const { registerWhatsappCampaign } = require('../../../services/aisensyCampaignSyncService');
const { runWithContext } = require('../../../utils/tenantContext');
const { resolveDefaultTenantId } = require('../../../utils/defaultTenant');

const BACKUPS_LIST_CACHE_KEY = 'data-hub:backups:list:v1';
const BACKUPS_LIST_TTL_SECONDS = 30;

let backupInProgress = false;
let hubRebuildInProgress = false;

const HAVELLS_INLET_KEYS = [
  'havells_registered',
  'havells_selected',
  'havells_attended_delhi',
  'havells_attended_indore',
  'havells_attended_dumka',
];

exports.getFolders = async (req, res) => {
  try {
    const data = await DataHubService.getFolderCounts();
    res.json({ ...data, ...getDataHubRuntimeFlags() });
  } catch (error) {
    logger.error('dataHubController', 'getFolders', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
};

exports.listPeople = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const result = await DataHubService.listPeople({
      folder: req.query.folder || 'all',
      search: req.query.search || '',
      page,
      limit,
      campaign: req.query.campaign,
      originSource: req.query.originSource,
      emailStatus: req.query.emailStatus,
      sort: req.query.sort,
      order: req.query.order,
    });
    res.json(result);
  } catch (error) {
    logger.error('dataHubController', 'listPeople', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch people' });
  }
};

exports.getPerson = async (req, res) => {
  try {
    const section = req.query.section;
    if (section) {
      const data = await DataHubService.getPersonSection(req.params.id, section);
      if (!data) return res.status(404).json({ error: 'Person not found' });
      return res.json(data);
    }
    if (req.query.full === 'true' || req.query.full === '1') {
      const person = await DataHubService.getPerson360(req.params.id);
      if (!person) return res.status(404).json({ error: 'Person not found' });
      return res.json(person);
    }
    const person = await DataHubService.getPersonBase(req.params.id);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (error) {
    logger.error('dataHubController', 'getPerson', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch person' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const folder = req.query.folder || 'all';
    const data = await DataHubService.getAnalytics(folder);
    res.json(data);
  } catch (error) {
    logger.error('dataHubController', 'getAnalytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

exports.getOverlap = async (req, res) => {
  try {
    const overlap = await DataHubService.getOverlapMatrix();
    res.json({ overlap });
  } catch (error) {
    logger.error('dataHubController', 'getOverlap', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch overlap matrix' });
  }
};

exports.reconcile = async (req, res) => {
  try {
    if (!isDataHubReconcileEnabled()) {
      return res.status(403).json({
        error: 'Data Hub reconcile is disabled in this environment (DATA_HUB_RECONCILE_ENABLED=false).',
        ...getDataHubRuntimeFlags(),
      });
    }
    const full = req.query.full === 'true';
    const result = await DataHubService.syncAllInlets({ full, incremental: !full });
    res.json({
      message: full ? 'Full sync complete' : 'New data synced',
      stats: result,
      lastSyncedAt: result.syncedAt,
    });
  } catch (error) {
    logger.error('dataHubController', 'reconcile', { error: error.message });
    res.status(500).json({ error: 'Sync failed' });
  }
};

exports.rebuildPersonHub = async (req, res) => {
  if (hubRebuildInProgress) {
    return res.status(429).json({ error: 'Person hub rebuild already in progress. Try again in a few minutes.' });
  }
  hubRebuildInProgress = true;
  try {
    const full = req.query.full === 'true';
    const havellsOnly = req.query.havells === 'true';
    const filter = havellsOnly ? { 'inlets.key': { $in: HAVELLS_INLET_KEYS } } : null;
    const result = await DataHubService.rebuildPersonHubFromIndex({
      mode: full ? 'full' : 'sync',
      filter,
    });
    res.json({
      message: full
        ? 'Person hub view fully rebuilt from PersonIndex'
        : 'Person hub inlet keys synced from PersonIndex',
      stats: result,
    });
  } catch (error) {
    logger.error('dataHubController', 'rebuildPersonHub', { error: error.message });
    res.status(500).json({ error: error.message || 'Hub rebuild failed' });
  } finally {
    hubRebuildInProgress = false;
  }
};

exports.getSyncStatus = async (req, res) => {
  try {
    const state = await DataHubService.getSyncState();
    res.json({
      lastSyncedAt: state.lastSyncedAt,
      lastFullSyncAt: state.lastFullSyncAt,
      lastStats: state.lastStats,
      ...getDataHubRuntimeFlags(),
    });
  } catch (error) {
    logger.error('dataHubController', 'getSyncStatus', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
};

exports.listBackups = async (req, res) => {
  try {
    const cached = await getCache(BACKUPS_LIST_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    const listing = await listAvailableBackups();
    const payload = {
      destination: listing.destination || getBackupDestination(),
      backupDatabase: listing.backupDatabase,
      snapshots: listing.snapshots || [],
    };
    await setCache(BACKUPS_LIST_CACHE_KEY, payload, BACKUPS_LIST_TTL_SECONDS);
    res.json(payload);
  } catch (error) {
    logger.error('dataHubController', 'listBackups', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to list backups' });
  }
};

exports.getBackupProgress = async (req, res) => {
  try {
    res.json(getBackupProgress());
  } catch (error) {
    logger.error('dataHubController', 'getBackupProgress', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to read backup progress' });
  }
};

exports.runProductionBackup = async (req, res) => {
  const progress = getBackupProgress();
  if (backupInProgress || progress.status === 'running') {
    return res.status(409).json({ error: 'A backup is already running. Wait for it to finish.' });
  }

  const notify = req.query.notify !== 'false';
  backupInProgress = true;

  res.status(202).json({
    started: true,
    message: 'Production backup started',
    progress: getBackupProgress(),
  });

  try {
    const result = await runDailyBackup();

    if (notify) {
      try {
        await notifyBackupResult(result);
      } catch (emailError) {
        logger.error('dataHubController', 'runProductionBackup notify', {
          error: emailError.message,
        });
      }
    }
  } catch (error) {
    logger.error('dataHubController', 'runProductionBackup', { error: error.message });
  } finally {
    backupInProgress = false;
  }
};

exports.listCampaignOutcomes = async (req, res) => {
  try {
    const summaries = await listCampaignSummaries();
    const baseUrl = process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
    res.json({
      campaigns: summaries,
      webhook: {
        url: baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/webhooks/aisensy` : '/api/webhooks/aisensy',
        verifyTokenEnv: 'AISENSY_WEBHOOK_VERIFY_TOKEN',
        secretEnv: 'AISENSY_WEBHOOK_SECRET',
        events: ['sent', 'delivered', 'read', 'failed', 'replied', 'clicked'],
      },
    });
  } catch (error) {
    logger.error('dataHubController', 'listCampaignOutcomes', { error: error.message });
    res.status(500).json({ error: 'Failed to list campaign outcomes' });
  }
};

exports.importCampaignOutcomes = async (req, res) => {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ error: 'CSV file required' });
    }
    const campaignName = req.body.campaignName
      || inferCampaignNameFromFilename(req.file.originalname || '');
    const defaultStatus = req.body.status
      || inferStatusFromFilename(req.file.originalname || '');
    const tags = req.body.tags
      ? String(req.body.tags).split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
      : [];
    const tenantId = await resolveDefaultTenantId();
    const stats = await runWithContext({ tenantId }, () => importAisensyCampaignCsv({
      filePath: req.file.path,
      campaignName,
      defaultStatus,
      tags,
      sourceFilename: req.file.originalname,
      dryRun: false,
    }));
    res.json({ message: 'Campaign outcomes imported', stats });
  } catch (error) {
    logger.error('dataHubController', 'importCampaignOutcomes', { error: error.message });
    res.status(500).json({ error: error.message || 'Import failed' });
  }
};

exports.registerWhatsappCampaign = async (req, res) => {
  try {
    const campaignName = String(req.body?.campaignName || '').trim();
    if (!campaignName) {
      return res.status(400).json({ error: 'campaignName required' });
    }
    const tags = req.body?.tags
      ? (Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags).split(/[,;|]/))
      : [];
    const tenantId = await resolveDefaultTenantId();
    const doc = await runWithContext({ tenantId }, () => registerWhatsappCampaign(campaignName, tags));
    res.json({ message: 'Campaign registered', campaign: doc });
  } catch (error) {
    logger.error('dataHubController', 'registerWhatsappCampaign', { error: error.message });
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
};
