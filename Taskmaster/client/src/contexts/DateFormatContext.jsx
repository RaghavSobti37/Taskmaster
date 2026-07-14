import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { listDateFormatOptions } from '@shared/dateFormatStandard';
import { setActiveDateFormat } from '../utils/dateFormatRegistry';

const DateFormatContext = createContext(null);

function detectRegion() {
  try {
    return navigator.language || 'en-IN';
  } catch {
    return 'en-IN';
  }
}

export function DateFormatProvider({ children }) {
  const preference = 'dmY';
  const region = detectRegion();

  useEffect(() => {
    setActiveDateFormat(preference, region);
  }, [region]);

  const value = useMemo(
    () => ({
      preference,
      region,
      options: listDateFormatOptions(),
    }),
    [region]
  );

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat() {
  const ctx = useContext(DateFormatContext);
  if (!ctx) throw new Error('useDateFormat must be used within DateFormatProvider');
  return ctx;
}
