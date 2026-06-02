import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'

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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_bW9jay1jbGVyay1wdWJsaXNoYWJsZS1rZXkuY2xlcmsuYWNjb3VudHMuZGV2JA';

import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { registerSW } from 'virtual:pwa-register';
import { warnIfDevPointsAtProduction } from './utils/devEnvGuard';

warnIfDevPointsAtProduction();
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID"}>
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
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
