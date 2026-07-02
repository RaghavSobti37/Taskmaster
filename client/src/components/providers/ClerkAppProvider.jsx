import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import {
  getClerkFrontendApiHost,
  getClerkProxyUrl,
  getClerkPublishableKey,
  isClerkConfigured,
} from '../../config/clerk';
import { clerkAuthAppearance, clerkAuthLocalization } from '../../config/clerkAppearance';
import {
  getAppOrigin,
  getAuthOrigin,
  getClerkProviderRedirectProps,
  getLandingOrigin,
} from '../../config/siteUrls';

const publishableKey = getClerkPublishableKey();
const frontendApi = getClerkFrontendApiHost();
const proxyUrl = getClerkProxyUrl();

const clerkRedirectOrigins = () => {
  const origins = new Set([
    getAppOrigin(),
    getAuthOrigin(),
    getLandingOrigin(),
  ]);
  return [...origins].filter(Boolean);
};

/** Must render inside React Router — wires Clerk path subflows (client-trust, MFA). */
export default function ClerkAppProvider({ children }) {
  const navigate = useNavigate();
  const allowedRedirectOrigins = useMemo(() => clerkRedirectOrigins(), []);
  const providerRedirectProps = useMemo(() => getClerkProviderRedirectProps(), []);

  const routerPush = useCallback((to) => {
    navigate(to);
  }, [navigate]);

  const routerReplace = useCallback((to) => {
    navigate(to, { replace: true });
  }, [navigate]);

  if (!isClerkConfigured()) {
    return children;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      {...(proxyUrl ? { proxyUrl } : frontendApi ? { frontendApi } : {})}
      appearance={clerkAuthAppearance}
      localization={clerkAuthLocalization}
      routerPush={routerPush}
      routerReplace={routerReplace}
      signInUrl="/login"
      signUpUrl="/register"
      afterSignOutUrl="/login"
      {...providerRedirectProps}
      allowedRedirectOrigins={allowedRedirectOrigins}
    >
      {children}
    </ClerkProvider>
  );
}
