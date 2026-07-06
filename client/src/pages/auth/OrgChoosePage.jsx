import React, { useEffect, useRef, useState } from 'react';
import { OrganizationList, useAuth as useClerkAuth, useClerk } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import BootScreen from '../../components/BootScreen';
import { isClerkConfigured } from '../../config/clerk';
import { clerkAuthAppearance, clerkAuthShellClass } from '../../config/clerkAppearance';
import { isOrgFirstAuthEnabled, loadOrgFirstAuthConfig } from '../../lib/orgFirstAuth';
import { reestablishClerkOrgSession } from '../../lib/reestablishClerkOrgSession';
import { navigateOnce, resetNavigateGuard } from '../../lib/postLoginRedirect';
import { useAuth } from '../../contexts/AuthContext';
import { navigateAfterAuth } from '../../utils/authNavigation';
import { appUrl } from '../../config/siteUrls';

export default function OrgChoosePage() {
  if (!isClerkConfigured()) {
    return <OrgChooseFallback reason="clerk" />;
  }
  return <OrgChoosePageWithClerk />;
}

function OrgChooseFallback({ reason }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (reason === 'clerk') {
      navigate('/org/pick', { replace: true });
    }
  }, [reason, navigate]);

  return null;
}

function OrgChoosePageWithClerk() {
  const { isLoaded, isSignedIn, orgId } = useClerkAuth();
  const { getToken, setActive } = useClerk();
  const { confirmSessionFromEstablish, sessionReady, user } = useAuth();
  const navigate = useNavigate();
  const [configReady, setConfigReady] = useState(false);
  const [error, setError] = useState(null);
  const [establishing, setEstablishing] = useState(false);
  const prevOrgRef = useRef(null);
  const handledOrgRef = useRef(null);

  useEffect(() => {
    resetNavigateGuard();
    void loadOrgFirstAuthConfig().then(() => setConfigReady(true));
  }, []);

  useEffect(() => {
    if (!configReady) return;
    if (!isOrgFirstAuthEnabled()) {
      navigate('/org/pick', { replace: true });
    }
  }, [configReady, navigate]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId || establishing) return;
    if (handledOrgRef.current === orgId) return;

    if (prevOrgRef.current === null) {
      prevOrgRef.current = orgId;
      if (sessionReady && user) {
        navigateOnce(navigate, appUrl('/dashboard'));
      }
      return;
    }

    if (orgId === prevOrgRef.current) return;

    prevOrgRef.current = orgId;
    handledOrgRef.current = orgId;
    setEstablishing(true);
    setError(null);

    reestablishClerkOrgSession({
      getToken,
      setActive,
      orgId,
      confirmSessionFromEstablish,
    })
      .then(() => {
        navigateOnce(navigate, appUrl('/dashboard'));
        navigateAfterAuth(navigate, appUrl('/dashboard'));
      })
      .catch((err) => {
        handledOrgRef.current = null;
        setError(err?.message || 'Could not open workspace');
        setEstablishing(false);
      });
  }, [
    isLoaded,
    isSignedIn,
    orgId,
    establishing,
    sessionReady,
    user,
    getToken,
    setActive,
    confirmSessionFromEstablish,
    navigate,
  ]);

  if (!configReady || !isLoaded) {
    return <BootScreen />;
  }

  if (!isOrgFirstAuthEnabled()) {
    return null;
  }

  if (!isSignedIn) {
    return null;
  }

  if (establishing) {
    return <BootScreen />;
  }

  return (
    <AuthMarketingShell subtitle="Pick the workspace you want to open.">
      {error ? (
        <div
          className="mb-4 rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100 text-center"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className={clerkAuthShellClass} data-clerk-org-choose-shell>
        <OrganizationList
          hidePersonal
          appearance={clerkAuthAppearance}
        />
      </div>
    </AuthMarketingShell>
  );
}
