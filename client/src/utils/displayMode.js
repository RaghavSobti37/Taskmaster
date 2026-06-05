const STANDALONE_MODES = ['standalone', 'fullscreen', 'minimal-ui'];

/** Installed PWA / Add to Home Screen / iOS standalone */
export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  if (window.navigator.standalone === true) return true;
  return STANDALONE_MODES.some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches
  );
}

/** Touch phone/tablet browser (Safari/Chrome), including iPad desktop UA. */
export function isMobileBrowser() {
  if (typeof window === 'undefined') return false;
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true;
  if (navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform)) return true;
  return window.matchMedia('(pointer: coarse)').matches;
}

/** PWA + mobile browsers — same-origin /api keeps auth cookies first-party on iOS Safari. */
export function shouldUseSameOriginApi() {
  return isStandaloneDisplay() || isMobileBrowser();
}

/** Mouse/trackpad primary — not phone/tablet touch UI */
export function isDesktopLikeInput() {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(pointer: fine)').matches &&
    window.matchMedia('(hover: hover)').matches
  );
}

/** Desktop shortcut PWA: standalone window with desktop input */
export function isPwaDesktop() {
  return isStandaloneDisplay() && isDesktopLikeInput();
}

/** Sets html[data-pwa-desktop] so CSS + hooks share one signal */
export function applyPwaDesktopDocumentFlag() {
  if (typeof document === 'undefined') return;
  if (isPwaDesktop()) {
    document.documentElement.dataset.pwaDesktop = 'true';
  } else {
    delete document.documentElement.dataset.pwaDesktop;
  }
}

/** Re-apply display flags on resize / display-mode change */
export function watchDisplayModeFlags() {
  if (typeof window === 'undefined') return () => {};

  const refresh = () => applyPwaDesktopDocumentFlag();
  window.addEventListener('resize', refresh);
  STANDALONE_MODES.forEach((mode) => {
    window.matchMedia(`(display-mode: ${mode})`).addEventListener('change', refresh);
  });

  return () => {
    window.removeEventListener('resize', refresh);
    STANDALONE_MODES.forEach((mode) => {
      window.matchMedia(`(display-mode: ${mode})`).removeEventListener('change', refresh);
    });
  };
}
