const DataHubService = require('../services/DataHubService');
const { syncFromHolySheet } = require('../services/bookedCallsSyncService');
const logger = require('../utils/logger');

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

exports.syncBookedCalls = async (req, res) => {
  try {
    const { getDepartmentSlug } = require('../utils/departmentPermissions');
    const result = await syncFromHolySheet({
      sheetName: req.query.sheet || 'BookedCalls',
      userId: req.user._id,
      userRole: getDepartmentSlug(req.user),
    });
    DataHubService.clearFolderCache();
    res.json(result);
  } catch (error) {
    logger.error('dataHubController', 'syncBookedCalls', { error: error.message });
    res.status(500).json({ error: 'Booked calls sync failed' });
  }
};
