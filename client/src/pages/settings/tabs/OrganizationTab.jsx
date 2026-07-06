import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button, PageSkeleton, QueryErrorBanner, getQueryErrorMessage } from '../../../components/ui';
import OrgSettingsForm from '../../../components/org/OrgSettingsForm';
import {
  useOrgSettings,
  useUpdateOrgSettings,
  useOffboardOrganization,
} from '../../../hooks/queries/orgSettings';
import { useAuth } from '../../../contexts/AuthContext';
import { globalConfirm } from '../../../contexts/confirmContext';

const fetchMemberships = async () => {
  const { data } = await axios.get('/api/tenants/memberships', { withCredentials: true });
  return data;
};

export default function OrganizationTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: membershipsData, isLoading: membershipsLoading } = useQuery({
    queryKey: ['tenantMemberships'],
    queryFn: fetchMemberships,
    staleTime: 60_000,
  });

  const tenantId = membershipsData?.activeTenantId || user?.activeTenantId || user?.tenantId;
  const activeMembership = (membershipsData?.memberships || []).find(
    (m) => String(m.tenant?._id || m.tenant) === String(tenantId),
  );
  const role = activeMembership?.role;
  const canEdit = ['owner', 'admin'].includes(role);
  const canDelete = role === 'owner';

  const {
    data: tenant,
    isLoading: settingsLoading,
    error: settingsError,
    refetch,
  } = useOrgSettings(tenantId, Boolean(tenantId));

  const updateMutation = useUpdateOrgSettings(tenantId);
  const offboardMutation = useOffboardOrganization();

  const handleDeleteOrg = async () => {
    const orgName = tenant?.name || 'this organization';
    const ok = await globalConfirm.confirm({
      title: 'Delete organization?',
      message: `"${orgName}" will be scheduled for deletion in 14 days. All members lose access after that period. This cannot be undone.`,
      confirmLabel: 'Delete organization',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await offboardMutation.mutateAsync();
      const others = (membershipsData?.memberships || []).filter(
        (m) => String(m.tenant?._id || m.tenant) !== String(tenantId),
      );
      queryClient.clear();
      if (others.length > 0) {
        await axios.post(
          '/api/tenants/select',
          { tenantId: others[0].tenant?._id || others[0].tenant },
          { withCredentials: true },
        );
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/org/pick';
      }
    } catch (e) {
      await globalConfirm.confirm({
        title: 'Could not delete organization',
        message: e.response?.data?.error || e.message || 'Something went wrong',
        confirmLabel: 'OK',
        type: 'danger',
      });
    }
  };

  if (membershipsLoading || (tenantId && settingsLoading)) {
    return <PageSkeleton />;
  }

  if (!tenantId) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
        <div className="border-b border-[var(--color-bg-border)] pb-4">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Organization</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            No active organization. Select or create one first.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate('/org/pick')}>
          Choose organization
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="border-b border-[var(--color-bg-border)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Building2 size={22} className="text-[var(--color-brand-teal)]" aria-hidden />
          Organization
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Name, branding, and defaults for your organization.
        </p>
      </div>

      {settingsError ? (
        <QueryErrorBanner
          message={getQueryErrorMessage(settingsError, 'Failed to load organization settings')}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {!canEdit && (
            <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              Only organization owners and admins can edit these settings.
            </div>
          )}

          <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-6 sm:p-8">
            <OrgSettingsForm
              tenant={tenant}
              readOnly={!canEdit}
              saving={updateMutation.isPending}
              onSave={async (form) => {
                await updateMutation.mutateAsync(form);
              }}
            />
          </div>

          {canDelete && (
            <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
              <div className="flex gap-3">
                <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Danger zone</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    Permanently delete this organization and all its data after a 14-day grace period.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="danger"
                disabled={offboardMutation.isPending}
                onClick={handleDeleteOrg}
              >
                {offboardMutation.isPending ? 'Scheduling deletion…' : 'Delete organization'}
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
