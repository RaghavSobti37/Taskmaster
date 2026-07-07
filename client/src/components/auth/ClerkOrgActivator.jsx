import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/react';
import { getPinnedClerkOrganizationId, isClerkConfigured } from '../../config/clerk';
import { isAuthSite } from '../../config/siteMode';
import { isClerkSignInSubflowPath, resolveClerkSignInPathname } from '../../lib/clerkSignInFlow';

/**
 * Pins active Clerk organization for single-org deployments (e.g. The Shakti Collective).
 */
export default function ClerkOrgActivator() {
  if (!isClerkConfigured()) return null;
  return <ClerkOrgActivatorInner />;
}

function ClerkOrgActivatorInner() {
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const { setActive } = useClerk();
  const location = useLocation();
  const pinnedOrgId = getPinnedClerkOrganizationId();
  const signInPath = resolveClerkSignInPathname(location.pathname);

  useEffect(() => {
    if (!isClerkConfigured() || !pinnedOrgId || !isLoaded || !isSignedIn) return;
    // ponytail: auth host — ClerkSessionBridge owns setActive during clerk-establish
    if (isAuthSite()) return;
    if (isClerkSignInSubflowPath(signInPath)) return;
    if (orgId === pinnedOrgId) return;
    setActive({ organization: pinnedOrgId }).catch(() => {
      // ClerkSessionBridge surfaces org-pin failures during clerk-establish
    });
  }, [isLoaded, isSignedIn, orgId, pinnedOrgId, setActive, signInPath]);

  return null;
}
