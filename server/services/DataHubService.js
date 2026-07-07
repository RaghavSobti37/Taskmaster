const {
  clearFolderCache: clearFolderCacheState,
  resetHubModelCache,
} = require('../domains/data-hub/folderCache');
const { reconcilePerson } = require('../domains/data-hub/reconcileService');
const { listPeople, getFolderCounts } = require('../domains/data-hub/listService');
const {
  getPersonBase,
  getPersonSection,
  getPerson360,
} = require('../domains/data-hub/personDetailService');
const { getAnalytics, getOverlapMatrix } = require('../domains/data-hub/analyticsService');
const {
  syncAllInlets: runSyncAllInlets,
  getSyncState: fetchSyncState,
} = require('../domains/data-hub/syncService');
const { repairDuplicateInlets } = require('../domains/data-hub/repairService');
const PersonHubBuilder = require('./PersonHubBuilder');

class DataHubService {
  async reconcilePerson(email, phone) {
    return reconcilePerson(email, phone);
  }

  async listPeople(opts) {
    return listPeople(opts);
  }

  async getPersonBase(contactId) {
    return getPersonBase(contactId);
  }

  async getPersonSection(contactId, section) {
    return getPersonSection(contactId, section);
  }

  async getPerson360(contactId) {
    return getPerson360(contactId);
  }

  async getFolderCounts() {
    return getFolderCounts();
  }

  async getAnalytics(folder = 'all') {
    return getAnalytics(folder);
  }

  async getOverlapMatrix() {
    return getOverlapMatrix();
  }

  async getSyncState() {
    return fetchSyncState();
  }

  /**
   * Sync only new/changed records into PersonIndex hub (default).
   * Pass { full: true } to re-merge everything (one-off / script).
   */
  async syncAllInlets({ incremental = true, onProgress, full = false } = {}) {
    return runSyncAllInlets({
      incremental,
      onProgress,
      full,
      repairDuplicateInlets,
      clearFolderCache: () => this.clearFolderCache(),
    });
  }

  /** @deprecated Use syncAllInlets */
  async reconcileAll(opts = {}) {
    return this.syncAllInlets({ ...opts, full: opts.full ?? false, incremental: opts.full ? false : true });
  }

  clearFolderCache() {
    clearFolderCacheState();
    resetHubModelCache();
  }

  async rebuildPersonHubFromIndex({ mode = 'sync', filter = null } = {}) {
    if (mode === 'full') {
      try {
        const result = await PersonHubBuilder.rebuildFromPersonIndex({ embedded: true, filter });
        this.clearFolderCache();
        return { mode: 'full', ...result };
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const syncResult = await PersonHubBuilder.syncInletKeysFromPersonIndex({ filter });
        this.clearFolderCache();
        return { mode: 'inlet_sync', fallbackReason: error.message, ...syncResult };
      }
    }

    const syncResult = await PersonHubBuilder.syncInletKeysFromPersonIndex({ filter });
    this.clearFolderCache();
    return { mode: 'inlet_sync', ...syncResult };
  }
}

module.exports = new DataHubService();
