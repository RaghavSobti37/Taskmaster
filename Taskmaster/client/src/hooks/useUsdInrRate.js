import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const RATE_ENDPOINTS = ['/api/finance/usd-inr-rate', '/api/subscriptions/usd-inr-rate'];

async function fetchUsdInrRate() {
  for (const url of RATE_ENDPOINTS) {
    try {
      return (await axios.get(url)).data;
    } catch (err) {
      if (url === RATE_ENDPOINTS[RATE_ENDPOINTS.length - 1]) throw err;
    }
  }
  return null;
}

export function useUsdInrRate({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['usd-inr-rate'],
    queryFn: fetchUsdInrRate,
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
