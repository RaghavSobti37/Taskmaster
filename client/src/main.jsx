import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SidebarProvider } from './contexts/SidebarContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { BrowserRouter } from 'react-router-dom'

import { GoogleOAuthProvider } from '@react-oauth/google'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID"}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ThemeProvider>
            <SidebarProvider>
              <App />
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)

