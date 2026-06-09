import React, { lazy, Suspense } from 'react'
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
import { registerSW } from 'virtual:pwa-register';
import { warnIfDevPointsAtProduction } from './utils/devEnvGuard';
import { applyPwaDesktopDocumentFlag, watchDisplayModeFlags } from './utils/displayMode';
import { purgeExpiredNoteDrafts } from './utils/noteDraftStorage';
import { initSentry, setSentryUser, clearSentryUser } from './lib/sentry';
import { initDatadogRum, setDatadogUser, clearDatadogUser } from './lib/datadog';
/** Local-only UI feedback tool — stripped from production builds (Vite dead-code elimination). */
const AgentationDev = import.meta.env.DEV
  ? lazy(() => import('./components/dev/AgentationDev'))
  : null;

initSentry();
initDatadogRum();
applyPwaDesktopDocumentFlag();
watchDisplayModeFlags();
purgeExpiredNoteDrafts();
warnIfDevPointsAtProduction();

const CHUNK_RETRY_KEY = 'chunk-retry';

const reloadOnceForStaleAssets = () => {
  if (window.sessionStorage.getItem(CHUNK_RETRY_KEY)) return;
  window.sessionStorage.setItem(CHUNK_RETRY_KEY, 'true');
  window.location.reload();
};

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target?.tagName !== 'SCRIPT' || !target.src) return;
    if (!/\.(js|mjs)(\?|$)/i.test(target.src)) return;
    reloadOnceForStaleAssets();
  }, true);
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
  registerSW({ immediate: true });
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ThemeProvider>
            <MotionConfigBridge>
              <SidebarProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <UnsavedChangesProvider>
                      <App />
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
  </React.StrictMode>,
)
