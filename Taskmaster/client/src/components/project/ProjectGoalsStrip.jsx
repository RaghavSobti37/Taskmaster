import React from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Target, Pencil } from 'lucide-react';
import { Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { getProjectRoleForUser } from '../../constants/taskOptions';
import ProjectGoalMetricCards, { ProjectGoalMetricCardsSkeleton } from './ProjectGoalMetricCards';

export default function ProjectGoalsStrip({ projectId, project, onEditGoals, deferLoad = false }) {
  const { user } = useAuth();
  const role = getProjectRoleForUser(project, user?._id);
  const canEdit = isAdminUser(user) || role === 'admin' || role === 'manager';

  const { data, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'goals'],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/goals`)).data,
    enabled: !!projectId && !deferLoad,
    staleTime: 60_000,
  });

  const progress = data?.progress || {};
  const weekly = data?.weekly;
  const history = data?.history || [];

  return (
    <div className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]/60 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target size={14} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] truncate">
            Project goals
          </span>
        </div>
        {canEdit && !isLoading && (
          <Button variant="secondary" size="sm" onClick={onEditGoals} className="shrink-0">
            <Pencil size={12} /> Edit
          </Button>
        )}
      </div>
      {deferLoad ? (
        <p className="text-[11px] text-[var(--color-text-muted)]">Goals load in sidebar after tasks…</p>
      ) : isLoading ? (
        <ProjectGoalMetricCardsSkeleton compact />
      ) : (
        <ProjectGoalMetricCards
          progress={progress}
          weekly={weekly}
          history={history}
          compact
        />
      )}
    </div>
  );
}
