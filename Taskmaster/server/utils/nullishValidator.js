/**
 * Global nullish check validator utility
 * Automatically catches empty strings, null, undefined, or failed blocks and maps them to "N/A" or null for numbers
 */
const validateMetric = (value, isNumeric = false) => {
  if (value === null || value === undefined || value === '' || Number.isNaN(value) || (isNumeric && Number.isNaN(Number(value)))) {
    return isNumeric ? null : 'N/A';
  }
  return isNumeric ? Number(value) : value;
};

module.exports = { validateMetric };
