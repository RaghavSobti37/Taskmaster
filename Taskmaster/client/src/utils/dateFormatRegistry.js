import { getDateFormatPatterns } from '@shared/dateFormatStandard';

let activePreference = 'dmY';
let activeRegion = 'en-IN';

export function setActiveDateFormat(preference, region = 'en-IN') {
  activePreference = preference || 'auto';
  activeRegion = region || 'en-IN';
}

export function getActiveDateFormatPatterns() {
  return getDateFormatPatterns(activePreference, activeRegion);
}
