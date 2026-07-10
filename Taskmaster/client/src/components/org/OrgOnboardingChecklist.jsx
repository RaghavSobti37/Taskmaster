import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, Circle } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useOrgOptional } from '../../contexts/OrgContext';
import { orgQueryKey } from '../../lib/orgQuery';

const fetchOnboarding = async (tenantId) => {
  const { data } = await axios.get(`/api/tenants/${tenantId}/unlocks`, { withCredentials: true });
  return data;
};

function sortStepsIncompleteFirst(steps, completed) {
  return [...steps].sort((a, b) => {
    const aDone = completed.has(a.id);
    const bDone = completed.has(b.id);
    if (aDone === bDone) return 0;
    return aDone ? 1 : -1;
  });
}

export default function OrgOnboardingChecklist({
  defaultExpanded = false,
  optimisticCompletedSteps = [],
}) {
  const { user } = useAuth();
  const org = useOrgOptional();
  const tenantId = org?.activeTenantId || user?.activeTenantId || user?.tenantId;
  const queryClient = useQueryClient();

  const orgOnboarding = org?.onboarding;
  const useOrgBootstrap = Boolean(org?.isReady && orgOnboarding);

  const { data: tenantData } = useQuery({
    queryKey: org?.orgSlug
      ? orgQueryKey(org.orgSlug, 'onboarding')
      : ['tenantOnboarding', tenantId],
    queryFn: () => fetchOnboarding(tenantId),
    enabled: Boolean(tenantId) && !useOrgBootstrap,
    staleTime: 60_000,
  });

  const checklistData = useOrgBootstrap ? orgOnboarding : tenantData;

  const dismissMutation = useMutation({
    mutationFn: () => axios.patch(
      `/api/tenants/${tenantId}/onboarding`,
      { dismissChecklist: true },
      { withCredentials: true },
    ),
    onSuccess: ({ data }) => {
      const key = org?.orgSlug
        ? orgQueryKey(org.orgSlug, 'onboarding')
        : ['tenantOnboarding', tenantId];
      queryClient.setQueryData(key, (current) => ({
        ...current,
        ...data,
      }));
      org?.invalidate?.();
    },
  });

  const steps = checklistData?.checklistSteps || [];
  const progress = checklistData?.onboardingProgress;
  const completed = new Set([
    ...(progress?.completedSteps || []),
    ...optimisticCompletedSteps,
  ]);
  const sortedSteps = useMemo(
    () => sortStepsIncompleteFirst(steps, completed),
    [steps, completed],
  );

  const totalCount = checklistData?.totalCount ?? steps.length;
  const completedCount = checklistData?.completedCount ?? steps.filter((s) => completed.has(s.id)).length;
  const percent = checklistData?.percent ?? (totalCount ? Math.round((completedCount / totalCount) * 100) : 0);
  const allDone = totalCount > 0 && completedCount >= totalCount;

  if (!tenantId || !checklistData || !checklistData.checklistVisible || allDone || steps.length === 0) return null;

  return (
    <DashboardWidgetShell
      title="Get started"
      className={defaultExpanded ? 'ring-2 ring-[var(--color-action-primary)]/25' : ''}
      actions={(
        <button
          type="button"
          onClick={() => dismissMutation.mutate()}
          className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Dismiss
        </button>
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            {completedCount}
            {' '}
            of
            {' '}
            {totalCount}
            {' '}
            complete
          </span>
          <span>
            {percent}
            %
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-action-primary)] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <ul className="space-y-2">
          {sortedSteps.map((step) => {
            const done = completed.has(step.id);
            return (
              <li key={step.id} className="flex items-start gap-2 text-sm">
                {done ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <Circle size={16} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                )}
                <span className={done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </DashboardWidgetShell>
  );
}
