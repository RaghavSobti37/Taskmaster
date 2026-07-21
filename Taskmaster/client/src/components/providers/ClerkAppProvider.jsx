import React, { useCallback, useMemo, Component } from 'react';
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

/**
 * Captures ClerkProvider render errors so the auth page degrades gracefully
 * instead of showing a blank white screen.
 */
class ClerkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ClerkErrorBoundary] Clerk provider crashed:', error.message, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[var(--brand-cream-wash)] p-8">
          <div className="max-w-md text-center space-y-4">
            <p className="text-sm text-red-200">
              Authentication provider failed to load.
            </p>
            <p className="text-xs text-teal-100/70">
              This may be due to a network issue or ad blocker. Try disabling extensions or clearing cookies.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ClerkErrorBoundary>
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
    </ClerkErrorBoundary>
  );
}
