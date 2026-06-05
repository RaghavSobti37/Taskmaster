import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext();

const readReducedMotionOverride = () => {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem('reducedMotion');
  if (saved === 'true') return true;
  if (saved === 'false') return false;
  return null;
};

export const ThemeProvider = ({ children }) => {
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

  // Theme Logic
  useEffect(() => {
    const resolveTheme = () => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme;
    };

    const resolved = resolveTheme();
    setEffectiveTheme(resolved);

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  }, [theme]);

  // System Theme Listener
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setEffectiveTheme(mediaQuery.matches ? 'dark' : 'light');
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

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
    setTheme(effectiveTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{
      theme, effectiveTheme, toggleTheme, setTheme,
      textSize, setTextSize,
      reducedMotion: reducedMotionOverride ?? osReducedMotion,
      effectiveReducedMotion,
      setReducedMotion,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
