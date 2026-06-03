import { useState, useEffect } from 'react';
import { isPwaDesktop } from '../utils/displayMode';

export const MOBILE_MAX = 1023;
export const DESKTOP_MIN = 1024;

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : DESKTOP_MIN,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}

export function useIsMobile() {
  const { width } = useWindowSize();
  if (isPwaDesktop()) return false;
  return width <= MOBILE_MAX;
}

export function useIsDesktop() {
  const { width } = useWindowSize();
  if (isPwaDesktop()) return true;
  return width >= DESKTOP_MIN;
}

/** Dev helper: warn when elements exceed viewport width */
export function auditHorizontalOverflow() {
  if (import.meta.env.PROD) return;
  const vw = window.innerWidth;
  const offenders = [];
  document.querySelectorAll('*').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > vw + 1 && rect.height > 0) {
      offenders.push({ el, width: Math.round(rect.width) });
    }
  });
  if (offenders.length) {
    console.warn('[mobile-audit] Horizontal overflow detected:', offenders.slice(0, 5));
  }
}
