import axios from 'axios';
import { apiPath } from './apiBase';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

/** Best-effort server-side HttpOnly cookie purge before a fresh login attempt. */
export async function purgeAuthCookies() {
  try {
    await axios.post(apiPath('/api/auth/logout'), null, AXIOS_SKIP_TOAST);
  } catch {
    /* cookie may already be absent */
  }
}
