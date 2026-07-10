import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyDocumentTheme,
  getSystemTheme,
  isPublicThemeRoute,
  resolveStoredThemePreference,
} from '../lib/publicRouteTheme';

const ThemeContext = createContext();

const readReducedMotionOverride = () => {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem('reducedMotion');
  if (saved === 'true') return true;
  if (saved === 'false') return false;
  return null;
};

export const ThemeProvider = ({ children }) => {
  const { pathname } = useLocation();
  const publicRoute = isPublicThemeRoute(pathname);

  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
      return 'system';
    }
    return 'system';
  });

  const [textSize, setTextSizeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('textSize') || 'medium';
    }
    return 'medium';
  });

  const [reducedMotionOverride, setReducedMotionOverride] = useState(readReducedMotionOverride);
  const [osReducedMotion, setOsReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [effectiveTheme, setEffectiveTheme] = useState('light');

  const effectiveReducedMotion = useMemo(
    () => (reducedMotionOverride !== null ? reducedMotionOverride : osReducedMotion),
    [reducedMotionOverride, osReducedMotion]
  );

  const syncDocumentTheme = useCallback((resolved) => {
    setEffectiveTheme(resolved);
    applyDocumentTheme(resolved);
  }, []);

  // Public routes → OS scheme; authenticated app → saved preference (incl. system)
  useEffect(() => {
    const resolved = publicRoute ? getSystemTheme() : resolveStoredThemePreference(theme);
    syncDocumentTheme(resolved);
  }, [theme, publicRoute, syncDocumentTheme]);

  // Follow OS changes on public routes and when preference is "system"
  useEffect(() => {
    if (!publicRoute && theme !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      syncDocumentTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [publicRoute, theme, syncDocumentTheme]);

  // OS prefers-reduced-motion sync
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setOsReducedMotion(mediaQuery.matches);
    setOsReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Text Size Logic
  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
  }, [textSize]);

  // Reduced Motion Logic — dataset uses hyphenated data-reduced-motion
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(effectiveReducedMotion);
  }, [effectiveReducedMotion]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setTextSize = (newSize) => {
    setTextSizeState(newSize);
    localStorage.setItem('textSize', newSize);
  };

  const setReducedMotion = (value) => {
    setReducedMotionOverride(value);
    localStorage.setItem('reducedMotion', String(value));
  };

  const toggleTheme = () => {
    if (publicRoute) return;
    setTheme(effectiveTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{
      theme, effectiveTheme, toggleTheme, setTheme,
      textSize, setTextSize,
      reducedMotion: reducedMotionOverride ?? osReducedMotion,
      effectiveReducedMotion,
      setReducedMotion,
      isPublicThemeRoute: publicRoute,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
