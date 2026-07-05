import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, Circle } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';

const STEPS = [
  { id: 'profile_complete', label: 'Complete your profile', path: '/settings/profile' },
  { id: 'first_project', label: 'Create your first project', path: '/projects' },
  { id: 'invite_teammate', label: 'Invite a teammate', path: '/admin/users' },
];

const fetchOnboarding = async (tenantId) => {
  const { data } = await axios.get(`/api/tenants/${tenantId}/unlocks`, { withCredentials: true });
  return data;
};

export default function OrgOnboardingChecklist() {
  const { user } = useAuth();
  const tenantId = user?.activeTenantId || user?.tenantId;
  const queryClient = useQueryClient();

  const { data: tenantData } = useQuery({
    queryKey: ['tenantOnboarding', tenantId],
    queryFn: () => axios.get('/api/tenants/memberships', { withCredentials: true }).then((r) => r.data),
    enabled: Boolean(tenantId),
  });

  const dismissMutation = useMutation({
    mutationFn: () => axios.patch(`/api/tenants/${tenantId}/onboarding`, { dismissedChecklist: true }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenantOnboarding', tenantId] }),
  });

  const progress = tenantData?.onboardingProgress;
  if (!tenantId || progress?.dismissedChecklist) return null;

  const completed = new Set(progress?.completedSteps || []);

  return (
    <DashboardWidgetShell title="Get started" actions={(
      <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => dismissMutation.mutate()}>
        Dismiss
      </button>
    )}
    >
      <ul className="space-y-2">
        {STEPS.map((step) => {
          const done = completed.has(step.id);
          const Icon = done ? CheckCircle2 : Circle;
          return (
            <li key={step.id}>
              <a href={step.path} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <Icon className={`h-4 w-4 ${done ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'}`} />
                {step.label}
              </a>
            </li>
          );
        })}
      </ul>
    </DashboardWidgetShell>
  );
}
