const cron = require('node-cron');
const { isSupabaseEnabled } = require('../config/supabase');
const { backfillLogsAndAudits } = require('../services/supabase/syncService');
const { syncMailRollupsForAllUsers } = require('../services/supabase/mailRollupStore');
const logger = require('../utils/logger');

const initSupabaseSyncWorker = () => {
  if (!isSupabaseEnabled()) {
    logger.debug('supabaseSyncWorker', 'Skipped — Supabase secondary store not configured');
    return;
  }

  cron.schedule('15 */6 * * *', async () => {
    try {
      await backfillLogsAndAudits();
      await syncMailRollupsForAllUsers();
      logger.info('supabaseSyncWorker', 'Scheduled secondary sync complete');
    } catch (err) {
      logger.error('supabaseSyncWorker', 'Scheduled secondary sync failed', { error: err.message });
    }
  });

  logger.debug('supabaseSyncWorker', 'Scheduled Mongo → Supabase sync every 6 hours');
};

module.exports = { initSupabaseSyncWorker };
