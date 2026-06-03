import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const NAVBAR_PREFERENCES_QUERY_KEY = ['navbarPreferences'];

export const useNavbarPreferences = (enabled = true) => {
  return useQuery({
    queryKey: NAVBAR_PREFERENCES_QUERY_KEY,
    queryFn: async () => {
      const { data } = await axios.get('/api/customization/navbar');
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};
