/**
 * Unified person identity normalization — consolidates sanitizer, personNormalization, leadValidation.
 */
const sanitizer = require('../../utils/sanitizer');
const personNormalization = require('../../utils/personNormalization');
const leadValidation = require('../../utils/leadValidation');

module.exports = {
  ...sanitizer,
  ...personNormalization,
  ...leadValidation,
};
