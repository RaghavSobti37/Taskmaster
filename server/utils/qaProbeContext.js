const { AsyncLocalStorage } = require('async_hooks');

const qaProbeStorage = new AsyncLocalStorage();

function runWithQaSyncGamification(callback) {
  return qaProbeStorage.run({ syncGamification: true }, callback);
}

function isQaSyncGamification() {
  if (qaProbeStorage.getStore()?.syncGamification) return true;
  return process.env.QA_SYNC_GAMIFICATION === 'true';
}

/** True during admin QA Testing runs and integration HTTP probes. */
function isQaProbeActive() {
  return isQaSyncGamification();
}

module.exports = {
  qaProbeStorage,
  runWithQaSyncGamification,
  isQaSyncGamification,
  isQaProbeActive,
};
