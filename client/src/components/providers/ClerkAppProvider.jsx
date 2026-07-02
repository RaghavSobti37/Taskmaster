import React, { useMemo } from 'react';
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
  getLandingOrigin,
  resolveClerkForceRedirectUrl,
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

export default function ClerkAppProvider({ children }) {
  const allowedRedirectOrigins = useMemo(() => clerkRedirectOrigins(), []);
  const clerkForceRedirect = useMemo(() => resolveClerkForceRedirectUrl(), []);

  if (!isClerkConfigured()) {
    return children;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      {...(proxyUrl ? { proxyUrl } : frontendApi ? { frontendApi } : {})}
      appearance={clerkAuthAppearance}
      localization={clerkAuthLocalization}
      signInUrl="/login"
      signUpUrl="/register"
      afterSignOutUrl="/login"
      signInForceRedirectUrl={clerkForceRedirect}
      signUpForceRedirectUrl={clerkForceRedirect}
      allowedRedirectOrigins={allowedRedirectOrigins}
    >
      {children}
    </ClerkProvider>
  );
}
