import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Briefcase } from 'lucide-react';
import { Button, Input } from '../ui';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useAuth } from '../../contexts/AuthContext';
import {
  PROJECT_GOAL_METRIC_KEYS,
  PROJECT_GOAL_METRIC_LABELS,
} from '../../utils/projectGoalMetrics';
import ProjectGoalMetricCards, { ProjectGoalMetricCardsSkeleton } from './ProjectGoalMetricCards';
import { getCrmDigestSegmentForWorkspace } from '@shared/crmDigestProjects';

function buildDraft(goal) {
  return {
    targets: Object.fromEntries(
      PROJECT_GOAL_METRIC_KEYS.map((key) => [key, { target: goal?.targets?.[key]?.target ?? 0 }]),
    ),
    crmDigest: {
      monthlyTargetLakhs: goal?.crmDigest?.monthlyTargetLakhs ?? 0,
    },
  };
}

function contributionPct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default function WorkspaceGoalsPanel({ workspaceName }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const segment = getCrmDigestSegmentForWorkspace(workspaceName);
  const encoded = encodeURIComponent(workspaceName);

  const { data, isLoading, error } = useQuery({
    queryKey: ['workspaces', workspaceName, 'goals'],
    queryFn: async () => (await axios.get(`/api/projects/workspaces/${encoded}/goals`)).data,
    enabled: !!workspaceName,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => axios.put(`/api/projects/workspaces/${encoded}/goals`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceName, 'goals'] });
      setDraft(null);
    },
  });

  const canEdit = isAdminUser(user) || data?.canEdit;
  const editing = Boolean(draft);
  const progress = data?.progress || {};
  const breakdown = data?.projectBreakdown || [];

  return (
    <section className="py-8 space-y-6 mb-6 border-b border-[var(--color-bg-border)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Target size={16} className="text-[var(--color-brand-teal)]" />
            Workspace goals
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Cumulative progress across {data?.projectCount ?? 0} project{data?.projectCount === 1 ? '' : 's'} in this workspace.
          </p>
        </div>
        {canEdit && !editing && !isLoading && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setDraft(buildDraft(data?.goal))}>
            Edit targets
          </Button>
        )}
      </div>

      {isLoading && <ProjectGoalMetricCardsSkeleton />}
      {error && <p className="text-xs text-rose-400">Could not load workspace goals.</p>}

      {!isLoading && !editing && data && (
        <>
          <ProjectGoalMetricCards progress={progress} compact />
          {segment && (
            <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">CRM digest monthly target</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {Number(data.goal?.crmDigest?.monthlyTargetLakhs || 0).toLocaleString('en-IN')} Lakhs
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Used in daily manager email for {segment.label}
              </p>
            </div>
          )}
        </>
      )}

      {!canEdit && !isLoading && (
        <p className="text-xs text-[var(--color-text-muted)]">Only admins can change workspace targets.</p>
      )}

      {editing && draft && (
        <form
          className="space-y-4 rounded-xl border border-[var(--color-bg-border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(draft);
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Workspace targets</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROJECT_GOAL_METRIC_KEYS.map((key) => (
              <Input
                key={key}
                label={`${PROJECT_GOAL_METRIC_LABELS[key].label} target`}
                type="number"
                min="0"
                value={draft.targets[key].target}
                onChange={(e) => setDraft({
                  ...draft,
                  targets: {
                    ...draft.targets,
                    [key]: { target: e.target.value },
                  },
                })}
              />
            ))}
          </div>
          {segment && (
            <Input
              label="CRM digest monthly target (Lakhs)"
              type="number"
              min="0"
              step="0.1"
              value={draft.crmDigest.monthlyTargetLakhs}
              onChange={(e) => setDraft({
                ...draft,
                crmDigest: { monthlyTargetLakhs: e.target.value },
              })}
            />
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save workspace goals'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!isLoading && breakdown.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-[var(--color-text-muted)]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              Project contribution
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-bg-border)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
                  <th className="p-3 font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Project</th>
                  {PROJECT_GOAL_METRIC_KEYS.map((key) => (
                    <th key={key} className="p-3 font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {PROJECT_GOAL_METRIC_LABELS[key].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.projectId} className="border-b border-[var(--color-bg-border)] last:border-0">
                    <td className="p-3 font-semibold text-[var(--color-text-primary)]">
                      <Link to={`/projects/${row.projectId}`} className="hover:text-[var(--color-brand-teal)]">
                        {row.projectName}
                      </Link>
                    </td>
                    {PROJECT_GOAL_METRIC_KEYS.map((key) => {
                      const meta = PROJECT_GOAL_METRIC_LABELS[key];
                      const current = row.current?.[key] ?? 0;
                      const total = progress[key]?.current ?? 0;
                      const pct = contributionPct(current, total);
                      return (
                        <td key={key} className="p-3 text-[var(--color-text-muted)]">
                          <span className="font-semibold text-[var(--color-text-primary)]">{meta.format(current)}</span>
                          {total > 0 && (
                            <span className="ml-1 text-[10px]">({pct}%)</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-bg-primary)]">
                  <td className="p-3 font-bold uppercase text-[var(--color-text-muted)]">Workspace total</td>
                  {PROJECT_GOAL_METRIC_KEYS.map((key) => (
                    <td key={key} className="p-3 font-bold text-[var(--color-text-primary)]">
                      {PROJECT_GOAL_METRIC_LABELS[key].format(progress[key]?.current ?? 0)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Percentages show each project&apos;s share of the workspace cumulative total.
            Sum of project-level targets: shown in metric card info when workspace target is set.
          </p>
        </div>
      )}
    </section>
  );
}
