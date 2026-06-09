import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { mergeShortcutBindings } from '../lib/shortcutDefaultsShared';

export const SHORTCUT_PREFERENCES_QUERY_KEY = ['shortcutPreferences'];

export const useShortcutPreferences = (enabled = true) => {
  return useQuery({
    queryKey: SHORTCUT_PREFERENCES_QUERY_KEY,
    queryFn: async () => {
      const { data } = await axios.get('/api/customization/shortcuts');
      return {
        ...data,
        effectiveBindings: data.effectiveBindings || mergeShortcutBindings(data.bindings),
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};
