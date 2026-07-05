import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import axios from 'axios';
import { listDateFormatOptions } from '@shared/dateFormatPreference';
import { setActiveDateFormat } from '../utils/dateFormatRegistry';
import { useAuth } from './AuthContext';

const DateFormatContext = createContext(null);

function detectRegion() {
  try {
    return navigator.language || 'en-IN';
  } catch {
    return 'en-IN';
  }
}

export function DateFormatProvider({ children }) {
  const { user, applySessionUser } = useAuth();
  const preference = user?.dateFormatPreference || 'auto';
  const region = detectRegion();

  useEffect(() => {
    setActiveDateFormat(preference, region);
  }, [preference, region]);

  const setPreference = useCallback(
    async (next) => {
      const res = await axios.put('/api/users/profile', { dateFormatPreference: next });
      const updated = res.data?.user || res.data;
      if (updated) applySessionUser?.(updated);
      setActiveDateFormat(next, region);
      return updated;
    },
    [applySessionUser, region]
  );

  const value = useMemo(
    () => ({
      preference,
      region,
      options: listDateFormatOptions(),
      setPreference,
    }),
    [preference, region, setPreference]
  );

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat() {
  const ctx = useContext(DateFormatContext);
  if (!ctx) throw new Error('useDateFormat must be used within DateFormatProvider');
  return ctx;
}
