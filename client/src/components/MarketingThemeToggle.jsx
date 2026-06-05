import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/** Light/dark toggle for public marketing pages (home, privacy, legal). */
export default function MarketingThemeToggle({ className = '' }) {
  const { effectiveTheme, toggleTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`min-h-[40px] min-w-[40px] rounded-xl border border-border bg-card hover:bg-background text-foreground transition flex items-center justify-center touch-manipulation ${className}`}
    >
      {isDark ? (
        <Sun size={16} className="text-[var(--color-brand-pumpkin)]" />
      ) : (
        <Moon size={16} className="text-[var(--color-text-secondary)]" />
      )}
    </button>
  );
}
