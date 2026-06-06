import axios from 'axios';
import { apiPath, getDirectApiBaseUrl } from './apiBase';
import { markApiProxyUnhealthy, shouldFallbackToDirectApi } from './apiProxyHealth';
import { shouldUseSameOriginApi } from './displayMode';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

const PROXY_ERROR_STATUSES = new Set([404, 502, 503, 504]);

const isProxyFailure = (err) => {
  if (!err?.response) return true;
  return PROXY_ERROR_STATUSES.has(err.response.status);
};

/** Login POST — same-origin /api first; fall back to direct Render API when proxy is down. */
export async function postLogin(email, password) {
  const payload = { email, password };
  const config = { ...AXIOS_SKIP_TOAST, withCredentials: true };

  try {
    return await axios.post(apiPath('/api/auth/login'), payload, config);
  } catch (err) {
    const direct = getDirectApiBaseUrl();
    if (!direct || !shouldUseSameOriginApi() || !isProxyFailure(err)) {
      throw err;
    }
    markApiProxyUnhealthy();
    return axios.post(`${direct}/api/auth/login`, payload, config);
  }
}
