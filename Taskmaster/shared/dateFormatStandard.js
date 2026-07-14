/** ESM entry for Vite client - keep in sync with dateFormatStandard.cjs */

export const DATE_FORMAT_ID = 'dmY';

export const DATE_FORMAT_PATTERNS = {
  date: 'dd/MM/yyyy',
  dateShort: 'dd/MM/yyyy',
  datetime: 'dd/MM/yyyy HH:mm',
  datetimeSeconds: 'dd/MM/yyyy HH:mm:ss',
  datetime12h: 'dd/MM/yyyy h:mm a',
  datetime12hComma: 'dd/MM/yyyy, h:mm a',
  dobParse: 'dd/MM/yyyy',
  example: '29/06/2026',
};

export const DATE_FORMAT_CATALOG = [
  { id: DATE_FORMAT_ID, label: 'DD/MM/YYYY', example: DATE_FORMAT_PATTERNS.example },
];

export function getDateFormatPatterns() {
  return DATE_FORMAT_PATTERNS;
}

export function getDobPlaceholder() {
  return 'DD/MM/YYYY';
}

export function listDateFormatOptions() {
  return DATE_FORMAT_CATALOG;
}
