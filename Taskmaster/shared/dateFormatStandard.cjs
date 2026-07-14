/** CJS entry for Node server - keep in sync with dateFormatStandard.js */

const DATE_FORMAT_ID = 'dmY';

const DATE_FORMAT_PATTERNS = {
  date: 'dd/MM/yyyy',
  dateShort: 'dd/MM/yyyy',
  datetime: 'dd/MM/yyyy HH:mm',
  datetimeSeconds: 'dd/MM/yyyy HH:mm:ss',
  datetime12h: 'dd/MM/yyyy h:mm a',
  datetime12hComma: 'dd/MM/yyyy, h:mm a',
  dobParse: 'dd/MM/yyyy',
  example: '29/06/2026',
};

const DATE_FORMAT_CATALOG = [
  { id: DATE_FORMAT_ID, label: 'DD/MM/YYYY', example: DATE_FORMAT_PATTERNS.example },
];

function getDateFormatPatterns() {
  return DATE_FORMAT_PATTERNS;
}

function getDobPlaceholder() {
  return 'DD/MM/YYYY';
}

function listDateFormatOptions() {
  return DATE_FORMAT_CATALOG;
}

module.exports = {
  DATE_FORMAT_ID,
  DATE_FORMAT_PATTERNS,
  DATE_FORMAT_CATALOG,
  getDateFormatPatterns,
  getDobPlaceholder,
  listDateFormatOptions,
};
