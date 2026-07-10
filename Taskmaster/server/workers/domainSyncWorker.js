const { initDomainSyncWorker } = require('../services/sync/eventBus');

const initWorker = () => {
  initDomainSyncWorker();
};

module.exports = { initWorker, initDomainSyncWorker };
