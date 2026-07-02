import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import ClerkAppProvider from './components/providers/ClerkAppProvider';
import ClerkAuthEffects from './components/auth/ClerkAuthEffects';
import AuthApp from './AuthApp';
import CookieBanner from './components/CookieBanner';
import { bootstrapDocumentTheme } from './lib/publicRouteTheme';
import { unregisterServiceWorkers } from './utils/unregisterServiceWorkers';
import './index.css';

bootstrapDocumentTheme();
void unregisterServiceWorkers();

const loadAppFont = () => {
  import('@fontsource-variable/geist/wght.css').catch(() => {});
};
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(loadAppFont, { timeout: 2000 });
} else {
  window.setTimeout(loadAppFont, 0);
}

function AuthRoot() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    unregisterServiceWorkers().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || import.meta.env.VITE_AUTH_SELFCHECK !== 'true') return undefined;
    const expected = String(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();
    if (!expected) return undefined;
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg?.publishableKeyPrefix) return;
        if (!expected.startsWith(cfg.publishableKeyPrefix)) {
          console.error('[auth-selfcheck] Clerk key mismatch between Vercel build and Render API');
        }
      })
      .catch(() => {});
    return undefined;
  }, [ready]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--brand-cream-wash)] text-sm text-[var(--brand-teal-mid)]">
        Preparing sign-in…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ClerkAppProvider>
          <AuthProvider>
            <ClerkAuthEffects />
            <AuthApp />
            <CookieBanner />
          </AuthProvider>
        </ClerkAppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthRoot />
  </React.StrictMode>,
);
