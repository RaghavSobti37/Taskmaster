import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})


import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmProvider';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { registerSW } from 'virtual:pwa-register';
import { warnIfDevPointsAtProduction } from './utils/devEnvGuard';
import { applyPwaDesktopDocumentFlag } from './utils/displayMode';

applyPwaDesktopDocumentFlag();
warnIfDevPointsAtProduction();

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ThemeProvider>
            <SidebarProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <UnsavedChangesProvider>
                    <App />
                  </UnsavedChangesProvider>
                </ConfirmProvider>
              </ToastProvider>
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
