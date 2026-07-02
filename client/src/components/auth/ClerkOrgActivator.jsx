import { useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import { getPinnedClerkOrganizationId, isClerkConfigured } from '../../config/clerk';

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
  const pinnedOrgId = getPinnedClerkOrganizationId();

  useEffect(() => {
    if (!isClerkConfigured() || !pinnedOrgId || !isLoaded || !isSignedIn) return;
    if (orgId === pinnedOrgId) return;
    setActive({ organization: pinnedOrgId }).catch(() => {
      // ClerkSessionBridge surfaces org-pin failures during clerk-establish
    });
  }, [isLoaded, isSignedIn, orgId, pinnedOrgId, setActive]);

  return null;
}
