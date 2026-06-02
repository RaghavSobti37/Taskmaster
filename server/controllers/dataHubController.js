const DataHubService = require('../services/DataHubService');
const { runDailyBackup, listAvailableBackups, getBackupDbName } = require('../services/databaseBackupService');
const { notifyBackupResult } = require('../services/backupNotificationService');
const logger = require('../utils/logger');

let backupInProgress = false;

exports.getFolders = async (req, res) => {
  try {
    const data = await DataHubService.getFolderCounts();
    res.json(data);
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
    });
    res.json(result);
  } catch (error) {
    logger.error('dataHubController', 'listPeople', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch people' });
  }
};

exports.getPerson = async (req, res) => {
  try {
    const person = await DataHubService.getPerson360(req.params.id);
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

exports.getSyncStatus = async (req, res) => {
  try {
    const state = await DataHubService.getSyncState();
    res.json({
      lastSyncedAt: state.lastSyncedAt,
      lastFullSyncAt: state.lastFullSyncAt,
      lastStats: state.lastStats,
    });
  } catch (error) {
    logger.error('dataHubController', 'getSyncStatus', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
};

exports.listBackups = async (req, res) => {
  try {
    const snapshots = await listAvailableBackups();
    res.json({
      backupDatabase: getBackupDbName(),
      snapshots,
    });
  } catch (error) {
    logger.error('dataHubController', 'listBackups', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to list backups' });
  }
};

exports.runProductionBackup = async (req, res) => {
  if (backupInProgress) {
    return res.status(409).json({ error: 'A backup is already running. Wait for it to finish.' });
  }

  const notify = req.query.notify !== 'false';
  backupInProgress = true;

  try {
    const result = await runDailyBackup();

    if (notify) {
      try {
        await notifyBackupResult(result);
      } catch (emailError) {
        logger.error('dataHubController', 'runProductionBackup notify', {
          error: emailError.message,
        });
        if (result.success) {
          return res.status(200).json({
            ...result,
            emailSent: false,
            warning: `Backup saved but notification email failed: ${emailError.message}`,
          });
        }
      }
    }

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Backup failed',
        ...result,
      });
    }

    res.json({
      message: 'Production database backup completed',
      emailSent: notify,
      ...result,
    });
  } catch (error) {
    logger.error('dataHubController', 'runProductionBackup', { error: error.message });
    res.status(500).json({ error: error.message || 'Backup failed' });
  } finally {
    backupInProgress = false;
  }
};
