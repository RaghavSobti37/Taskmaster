import axios from 'axios';
import { apiPath } from './apiBase';

export const exchangeClerkSession = async (clerkToken) => {
  const response = await axios.post(
    apiPath('/api/auth/clerk-exchange'),
    null,
    {
      headers: { Authorization: `Bearer ${clerkToken}` },
      withCredentials: true,
    },
  );
  return response.data;
};
