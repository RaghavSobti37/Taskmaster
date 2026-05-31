import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

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

  const [reducedMotion, setReducedMotionState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('reducedMotion') === 'true';
    }
    return false;
  });

  const [effectiveTheme, setEffectiveTheme] = useState('light');

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

  // Text Size Logic
  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
  }, [textSize]);

  // Reduced Motion Logic
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setTextSize = (newSize) => {
    setTextSizeState(newSize);
    localStorage.setItem('textSize', newSize);
  };

  const setReducedMotion = (value) => {
    setReducedMotionState(value);
    localStorage.setItem('reducedMotion', value);
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, effectiveTheme, toggleTheme, setTheme,
      textSize, setTextSize,
      reducedMotion, setReducedMotion
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
