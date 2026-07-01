import React from 'react';
import { ClerkProvider } from '@clerk/react';
import {
  getClerkFrontendApiHost,
  getClerkProxyUrl,
  getClerkPublishableKey,
  isClerkConfigured,
} from '../../config/clerk';
import { clerkAuthAppearance, clerkAuthLocalization } from '../../config/clerkAppearance';

const publishableKey = getClerkPublishableKey();
const frontendApi = getClerkFrontendApiHost();
const proxyUrl = getClerkProxyUrl();

export default function ClerkAppProvider({ children }) {
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
    >
      {children}
    </ClerkProvider>
  );
}
