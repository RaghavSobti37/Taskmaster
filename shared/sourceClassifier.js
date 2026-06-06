/**
 * Classify imported / outsourced rows into the correct source model.
 */
const { isBookedCallSource } = require('./dataInlets');

const NEWSLETTER_RE = /newsletter|subscribe|subscription|mailing.?list|website.?signup|sign.?up|opt.?in/i;

const SOURCE_MODELS = {
  OUTSOURCED: 'outsourced',
  BOOKED_CALL: 'booked_call',
  NEWSLETTER: 'newsletter',
};

/**
 * @param {Object} row - { campaign, originSource, dataType, source, destination }
 * @returns {'outsourced'|'booked_call'|'newsletter'}
 */
function classifySourceRow(row = {}) {
  const parts = [
    row.campaign,
    row.originSource,
    row.dataType,
    row.source,
    row.destination,
  ]
    .filter(Boolean)
    .join(' ');

  if (isBookedCallSource(parts)) {
    return SOURCE_MODELS.BOOKED_CALL;
  }
  if (NEWSLETTER_RE.test(parts)) {
    return SOURCE_MODELS.NEWSLETTER;
  }
  return SOURCE_MODELS.OUTSOURCED;
}

/** Map classifier result to Data Hub inlet key */
function classifierToInletKey(modelKey) {
  switch (modelKey) {
    case SOURCE_MODELS.BOOKED_CALL:
      return 'booked_calls';
    case SOURCE_MODELS.NEWSLETTER:
      return 'newsletter';
    default:
      return 'outsourced';
  }
}

module.exports = {
  NEWSLETTER_RE,
  SOURCE_MODELS,
  classifySourceRow,
  classifierToInletKey,
};
