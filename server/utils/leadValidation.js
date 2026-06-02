const { MAX_NAME_LENGTH } = require('./sanitizer');
const { normalizePersonRecord, applyPersonFieldsTo } = require('./personNormalization');

/**
 * Normalize lead fields in place (same rules as CRM API).
 * @returns {string[]} validation errors; empty if ok
 */
function normalizeAndValidateLeadFields(leadData, options = {}) {
  const {
    requireName = false,
    requirePhone = false,
    tryRepairPhone = false,
  } = options;

  const normalized = normalizePersonRecord(leadData, {
    requireName,
    requirePhone,
    rejectPlaceholderPhone: requirePhone,
    tryRepairPhone,
  });

  applyPersonFieldsTo(leadData, normalized);

  return normalized.errors;
}

module.exports = { normalizeAndValidateLeadFields, normalizePersonRecord };
