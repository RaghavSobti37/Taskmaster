import axios from 'axios';
import { apiPath } from './apiBase';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

/** Login POST — always same-origin /api so the session cookie lands on the frontend domain. */
export async function postLogin(email, password) {
  return axios.post(
    apiPath('/api/auth/login'),
    { email, password },
    { ...AXIOS_SKIP_TOAST, withCredentials: true },
  );
}
