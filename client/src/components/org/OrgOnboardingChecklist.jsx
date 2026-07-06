import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, Circle } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';

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
  const { data: membershipsData } = useQuery({
    queryKey: ['tenantMemberships'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tenants/memberships', { withCredentials: true });
      return data;
    },
    staleTime: 60_000,
  });
  const tenantId = membershipsData?.activeTenantId || user?.activeTenantId || user?.tenantId;
  const queryClient = useQueryClient();

  const { data: tenantData } = useQuery({
    queryKey: ['tenantOnboarding', tenantId],
    queryFn: () => fetchOnboarding(tenantId),
    enabled: Boolean(tenantId),
  });

  const dismissMutation = useMutation({
    mutationFn: () => axios.patch(
      `/api/tenants/${tenantId}/onboarding`,
      { dismissChecklist: true },
      { withCredentials: true },
    ),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(['tenantOnboarding', tenantId], (current) => ({
        ...current,
        ...data,
      }));
    },
  });

  const steps = tenantData?.checklistSteps || [];
  const progress = tenantData?.onboardingProgress;
  const completed = new Set([
    ...(progress?.completedSteps || []),
    ...optimisticCompletedSteps,
  ]);
  const sortedSteps = useMemo(
    () => sortStepsIncompleteFirst(steps, completed),
    [steps, completed],
  );

  const totalCount = tenantData?.totalCount ?? steps.length;
  const completedCount = tenantData?.completedCount ?? steps.filter((s) => completed.has(s.id)).length;
  const percent = tenantData?.percent ?? (totalCount ? Math.round((completedCount / totalCount) * 100) : 0);
  const allDone = totalCount > 0 && completedCount >= totalCount;

  if (!tenantId || !tenantData || !tenantData.checklistVisible || allDone || steps.length === 0) return null;

  return (
    <DashboardWidgetShell
      title="Get started"
      className={defaultExpanded ? 'ring-2 ring-[var(--color-action-primary)]/25' : ''}
      actions={(
        <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => dismissMutation.mutate()}>
          Dismiss
        </button>
      )}
    >
      <div className="mb-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wide">
          <span>{completedCount} of {totalCount} complete</span>
          <span>{percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-bg-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-action-primary)] transition-all duration-300"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Onboarding progress"
          />
        </div>
      </div>
      <ul className="space-y-3">
        {sortedSteps.map((step) => {
          const done = completed.has(step.id);
          const Icon = done ? CheckCircle2 : Circle;
          return (
            <li key={step.id}>
              <a href={step.path} className="flex items-start gap-2 text-sm group">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${done ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'}`} />
                <span className="min-w-0">
                  <span className={`block font-medium ${done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'}`}>
                    {step.label}
                  </span>
                  {step.why && !done && (
                    <span className="block text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                      {step.why}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </DashboardWidgetShell>
  );
}
