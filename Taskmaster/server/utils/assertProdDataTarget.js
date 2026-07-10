const mongoose = require('mongoose');
const { getDbNameFromUri, isProdLikeDbName } = require('../config/database');

/**
 * AiSensy catalog sync must write to production DB only (no local/test pollution).
 */
function assertProdDataTarget(connection = mongoose.connection) {
  const dbName = connection?.name
    || getDbNameFromUri(connection?.client?.s?.url || '');
  if (!dbName || !isProdLikeDbName(dbName)) {
    const err = new Error(
      `AiSensy sync is production-only (connected DB: "${dbName || 'unknown'}"). `
      + 'Use npm run sync:aisensy-catalog:prod --prefix server -- --execute',
    );
    err.status = 403;
    err.code = 'PROD_DATA_REQUIRED';
    throw err;
  }
  return dbName;
}

module.exports = { assertProdDataTarget };
