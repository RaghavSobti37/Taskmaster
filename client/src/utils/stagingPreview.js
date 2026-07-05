import { getApiBaseUrl } from './apiBase';
import { isVercelPreviewHost } from './displayMode';

const PROD_API_PATTERNS = [/render\.com/i, /onrender\.com/i];

/** True when baked VITE_API_URL targets production Render / hosted API. */
export function pointsAtProductionApi() {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) return false;
  return PROD_API_PATTERNS.some((re) => re.test(apiUrl));
}

/** Vercel branch preview that intentionally uses production API + MongoDB. */
export function isStagingPreviewOnProdDb() {
  if (typeof window === 'undefined') return false;
  return isVercelPreviewHost() && pointsAtProductionApi();
}

export const STAGING_PROD_DB_BANNER_STORAGE_KEY = 'coreknot_staging_prod_db_banner_dismissed';
