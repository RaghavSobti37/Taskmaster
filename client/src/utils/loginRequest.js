import axios from 'axios';
import { apiPath } from './apiBase';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

/** Login POST — same-origin /api on mobile/PWA; direct Render on desktop prod. */
export async function postLogin(email, password) {
  return axios.post(
    apiPath('/api/auth/login'),
    { email, password },
    { ...AXIOS_SKIP_TOAST, withCredentials: true },
  );
}
