import React, { lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'


import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmProvider';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import {
  isStaleAssetScript,
  isStaleChunkError,
  recoverFromStaleChunks,
} from './utils/chunkRecovery';
import { warnIfDevPointsAtProduction } from './utils/devEnvGuard';
import { applyPwaDesktopDocumentFlag, watchDisplayModeFlags } from './utils/displayMode';
import { purgeExpiredNoteDrafts } from './utils/noteDraftStorage';
import { ensurePostHogForConsent, getPostHogClient } from './lib/posthog';
import { hasAnalyticsConsent } from './lib/cookieConsent';
import CookieBanner from './components/CookieBanner';
import PostHogConsentBridge from './components/PostHogConsentBridge';
import ClerkAppProvider from './components/providers/ClerkAppProvider';
import ClerkAuthEffects from './components/auth/ClerkAuthEffects';
import LocalFirstRoot from './components/pwa/LocalFirstRoot';
import { Analytics } from '@vercel/analytics/react';
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react';
/** Local-only UI feedback tool — compile-time false in production builds. */
const AgentationDev = __AGENTATION_ENABLED__
  ? lazy(() => import('./components/dev/AgentationDev'))
  : null;

const syncPostHogClient = () => {
  if (!hasAnalyticsConsent()) return getPostHogClient();
  ensurePostHogForConsent();
  return getPostHogClient();
};

syncPostHogClient();

function Root() {
  const [posthogClient, setPosthogClient] = useState(() => syncPostHogClient());

  useEffect(() => {
    const onReady = () => {
      const client = syncPostHogClient();
      if (client) setPosthogClient(client);
    };
    const onConsent = (event) => {
      if (!event.detail?.analytics) return;
      onReady();
    };
    window.addEventListener('coreknot:posthog-ready', onReady);
    window.addEventListener('coreknot:cookie-consent', onConsent);
    onReady();
    return () => {
      window.removeEventListener('coreknot:posthog-ready', onReady);
      window.removeEventListener('coreknot:cookie-consent', onConsent);
    };
  }, []);

  const tree = posthogClient ? (
    <PostHogProvider client={posthogClient}>
      <PostHogErrorBoundary fallback={appTree}>
        {appTree}
      </PostHogErrorBoundary>
    </PostHogProvider>
  ) : (
    appTree
  );

  return tree;
}

applyPwaDesktopDocumentFlag();
watchDisplayModeFlags();
purgeExpiredNoteDrafts();
warnIfDevPointsAtProduction();

const reloadOnceForStaleAssets = () => {
  void recoverFromStaleChunks();
};

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (!isStaleAssetScript(event.target)) return;
    reloadOnceForStaleAssets();
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkError(event.reason)) return;
    event.preventDefault();
    reloadOnceForStaleAssets();
  });
}

const loadAppFont = () => {
  import('@fontsource-variable/geist/wght.css').catch(() => {});
};
if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(loadAppFont, { timeout: 2000 });
} else {
  window.setTimeout(loadAppFont, 0);
}

const registerDeferredServiceWorker = () => {
  // Registration handled in LocalFirstRoot for update prompt coordination
};

if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
  window.requestIdleCallback(registerDeferredServiceWorker, { timeout: 4000 });
} else {
  window.setTimeout(registerDeferredServiceWorker, 2000);
}

const MotionConfigBridge = ({ children }) => {
  const { effectiveReducedMotion } = useTheme();
  return (
    <MotionConfig reducedMotion={effectiveReducedMotion ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  );
};

const appTree = (
  <ClerkAppProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ClerkAuthEffects />
          <ThemeProvider>
            <MotionConfigBridge>
              <SidebarProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <UnsavedChangesProvider>
                      <LocalFirstRoot>
                        <PostHogConsentBridge />
                        <App />
                      </LocalFirstRoot>
                      <CookieBanner />
                      {import.meta.env.PROD ? <Analytics /> : null}
                      {AgentationDev ? (
                        <Suspense fallback={null}>
                          <AgentationDev />
                        </Suspense>
                      ) : null}
                    </UnsavedChangesProvider>
                  </ConfirmProvider>
                </ToastProvider>
              </SidebarProvider>
            </MotionConfigBridge>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ClerkAppProvider>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
