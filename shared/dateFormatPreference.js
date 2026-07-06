/** ESM entry for Vite client — keep in sync with dateFormatPreference.cjs */

/** @typedef {'auto'|'dmY'|'mdY'|'Ymd'|'dmYDash'|'mdYDash'|'dmYShort'|'mdYShort'} DateFormatPreferenceId */

export const PREFERENCE_IDS = ['auto', 'dmY', 'mdY', 'Ymd', 'dmYDash', 'mdYDash', 'dmYShort', 'mdYShort'];

export const PATTERN_MAP = {
  dmY: {
    date: 'dd/MM/yyyy',
    dateShort: 'dd/MM',
    datetime: 'dd/MM/yyyy HH:mm',
    datetimeSeconds: 'dd/MM/yyyy HH:mm:ss',
    datetime12h: 'dd/MM/yyyy h:mm a',
    datetime12hComma: 'dd/MM/yyyy, h:mm a',
    dobParse: 'dd/MM/yyyy',
    example: '29/06/2026',
  },
  mdY: {
    date: 'MM/dd/yyyy',
    dateShort: 'MM/dd',
    datetime: 'MM/dd/yyyy HH:mm',
    datetimeSeconds: 'MM/dd/yyyy HH:mm:ss',
    datetime12h: 'MM/dd/yyyy h:mm a',
    datetime12hComma: 'MM/dd/yyyy, h:mm a',
    dobParse: 'MM/dd/yyyy',
    example: '06/29/2026',
  },
  Ymd: {
    date: 'yyyy-MM-dd',
    dateShort: 'MM-dd',
    datetime: 'yyyy-MM-dd HH:mm',
    datetimeSeconds: 'yyyy-MM-dd HH:mm:ss',
    datetime12h: 'yyyy-MM-dd h:mm a',
    datetime12hComma: 'yyyy-MM-dd, h:mm a',
    dobParse: 'yyyy-MM-dd',
    example: '2026-06-29',
  },
  dmYDash: {
    date: 'dd-MM-yyyy',
    dateShort: 'dd-MM',
    datetime: 'dd-MM-yyyy HH:mm',
    datetimeSeconds: 'dd-MM-yyyy HH:mm:ss',
    datetime12h: 'dd-MM-yyyy h:mm a',
    datetime12hComma: 'dd-MM-yyyy, h:mm a',
    dobParse: 'dd-MM-yyyy',
    example: '29-06-2026',
  },
  mdYDash: {
    date: 'MM-dd-yyyy',
    dateShort: 'MM-dd',
    datetime: 'MM-dd-yyyy HH:mm',
    datetimeSeconds: 'MM-dd-yyyy HH:mm:ss',
    datetime12h: 'MM-dd-yyyy h:mm a',
    datetime12hComma: 'MM-dd-yyyy, h:mm a',
    dobParse: 'MM-dd-yyyy',
    example: '06-29-2026',
  },
  dmYShort: {
    date: 'dd/MM/yy',
    dateShort: 'dd/MM',
    datetime: 'dd/MM/yy HH:mm',
    datetimeSeconds: 'dd/MM/yy HH:mm:ss',
    datetime12h: 'dd/MM/yy h:mm a',
    datetime12hComma: 'dd/MM/yy, h:mm a',
    dobParse: 'dd/MM/yy',
    example: '29/06/26',
  },
  mdYShort: {
    date: 'MM/dd/yy',
    dateShort: 'MM/dd',
    datetime: 'MM/dd/yy HH:mm',
    datetimeSeconds: 'MM/dd/yy HH:mm:ss',
    datetime12h: 'MM/dd/yy h:mm a',
    datetime12hComma: 'MM/dd/yy, h:mm a',
    dobParse: 'MM/dd/yy',
    example: '06/29/26',
  },
};

export const CATALOG = [
  { id: 'auto', label: 'Automatic (region)', example: '—' },
  { id: 'dmY', label: 'DD/MM/YYYY', example: PATTERN_MAP.dmY.example },
  { id: 'mdY', label: 'MM/DD/YYYY', example: PATTERN_MAP.mdY.example },
  { id: 'Ymd', label: 'YYYY-MM-DD', example: PATTERN_MAP.Ymd.example },
  { id: 'dmYDash', label: 'DD-MM-YYYY', example: PATTERN_MAP.dmYDash.example },
  { id: 'mdYDash', label: 'MM-DD-YYYY', example: PATTERN_MAP.mdYDash.example },
  { id: 'dmYShort', label: 'DD/MM/YY', example: PATTERN_MAP.dmYShort.example },
  { id: 'mdYShort', label: 'MM/DD/YY', example: PATTERN_MAP.mdYShort.example },
];

export function regionDefaultPreference(region = 'en-IN') {
  const r = String(region || 'en-IN');
  if (r === 'en-US' || r.startsWith('en-US')) return 'mdY';
  if (r === 'zh-CN' || r === 'ja-JP' || r === 'ko-KR' || r.startsWith('zh') || r.startsWith('ja') || r.startsWith('ko')) {
    return 'Ymd';
  }
  return 'dmY';
}

export function resolvePreferenceId(preference, region = 'en-IN') {
  const pref = preference || 'auto';
  if (pref === 'auto') return regionDefaultPreference(region);
  return pref;
}

export function getDateFormatPatterns(preference, region = 'en-IN') {
  const id = resolvePreferenceId(preference, region);
  return PATTERN_MAP[id] || PATTERN_MAP.dmY;
}

export function getDobPlaceholder(patterns) {
  const p = patterns?.dobParse || 'dd/MM/yyyy';
  if (p === 'dd/MM/yyyy') return 'DD/MM/YYYY';
  if (p === 'MM/dd/yyyy') return 'MM/DD/YYYY';
  if (p === 'yyyy-MM-dd') return 'YYYY-MM-DD';
  if (p === 'dd-MM-yyyy') return 'DD-MM-YYYY';
  if (p === 'MM-dd-yyyy') return 'MM-DD-YYYY';
  if (p === 'dd/MM/yy') return 'DD/MM/YY';
  if (p === 'MM/dd/yy') return 'MM/DD/YY';
  return p.toUpperCase().replace(/d/g, 'D').replace(/y/g, 'Y').replace(/m/g, 'M');
}

export function isValidDateFormatPreference(value) {
  return PREFERENCE_IDS.includes(value);
}

export function listDateFormatOptions() {
  return CATALOG;
}
