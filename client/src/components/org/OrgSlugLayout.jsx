import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { OrgProvider, useOrg } from '../../contexts/OrgContext';
import BootScreen from '../BootScreen';
import { QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { isReservedOrgSlug } from '../../lib/orgPaths';

function OrgSlugGate({ children }) {
  const { isReady, isLoading, error } = useOrg();

  if (isLoading && !isReady) {
    return <BootScreen />;
  }

  if (error) {
    const status = error?.response?.status;
    if (status === 403) {
      return <Navigate to="/org/pick" replace />;
    }
    if (status === 404) {
      return <Navigate to="/org/pick" replace />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Could not load organization')}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!isReady) {
    return <BootScreen />;
  }

  return children;
}

function OrgSlugSessionSync() {
  const { user, applySessionUser } = useAuth();
  const org = useOrg();

  React.useEffect(() => {
    if (!org?.tenant || !user) return;
    const tenantId = String(org.tenant._id);
    const slug = org.tenant.slug;
    if (
      String(user.activeTenantId || '') === tenantId
      && user.activeTenantSlug === slug
    ) {
      return;
    }
    applySessionUser({
      ...user,
      activeTenantId: tenantId,
      activeTenantSlug: slug,
      tenantId,
    });
  }, [org?.tenant, user, applySessionUser]);

  return null;
}

export default function OrgSlugLayout() {
  const { orgSlug } = useParams();
  const { sessionReady } = useAuth();

  if (isReservedOrgSlug(orgSlug)) {
    return <Navigate to="/" replace />;
  }

  if (!sessionReady) {
    return <BootScreen />;
  }

  return (
    <OrgProvider orgSlug={orgSlug}>
      <OrgSlugSessionSync />
      <OrgSlugGate>
        <Outlet />
      </OrgSlugGate>
    </OrgProvider>
  );
}
