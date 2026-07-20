/**
 * @deprecated Campaign email delivery moved to Auto-Mailer.
 * Keep this module as a compatibility bridge for old imports while delegating
 * transactional payloads to the central CoreKnot Auto-Mailer bridge.
 */
const { dispatchEmailPayload, normalizeToList } = require('../../../services/mailDriver');

module.exports = {
  dispatchEmailPayload,
  normalizeToList,
  resend: null,
};
