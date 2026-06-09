import React from 'react';
import { StatCard, Skeleton, Spinner } from '../ui';
import {
  PROJECT_GOAL_METRIC_KEYS,
  PROJECT_GOAL_METRIC_LABELS,
  formatGoalDelta,
  buildGoalSparklinePoints,
} from '../../utils/projectGoalMetrics';

function GoalMetricCardSkeleton({ compact = false }) {
  return (
    <div
      className={`p-3 flex flex-col gap-2 rounded-[var(--radius-atomic)] border-l-2 border-l-[var(--color-pastel-mint-text)] bg-[var(--color-bg-surface)] h-full ${compact ? '!p-2.5' : ''}`}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <Skeleton width="72px" height="10px" />
        <Skeleton width="12px" height="12px" variant="circle" />
      </div>
      <div className="flex items-end justify-between gap-2 mt-auto min-h-[2.5rem]">
        <div className="flex items-center gap-2 min-w-0">
          <Skeleton width="88px" height="24px" />
          <Skeleton width="40px" height="12px" />
        </div>
        <Spinner size="sm" className="text-[var(--color-pastel-mint-text)] shrink-0" />
      </div>
    </div>
  );
}

export function ProjectGoalMetricCardsSkeleton({ compact = false }) {
  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4'}`}>
      {PROJECT_GOAL_METRIC_KEYS.map((key) => (
        <GoalMetricCardSkeleton key={key} compact={compact} />
      ))}
    </div>
  );
}

function GoalSparkline({ history, metricKey }) {
  const points = buildGoalSparklinePoints(history, metricKey);
  if (!points) return null;
  return (
    <svg width={72} height={22} viewBox="0 0 72 22" className="text-emerald-400/80" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function ProjectGoalMetricCards({
  progress = {},
  weekly,
  history = [],
  compact = false,
}) {
  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4'}`}>
      {PROJECT_GOAL_METRIC_KEYS.map((key) => {
        const meta = PROJECT_GOAL_METRIC_LABELS[key];
        const p = progress[key] || { current: 0, target: 0 };
        const increment = weekly?.increments?.[key];
        let info = p.target ? `Target: ${meta.format(p.target)}` : 'Auto-synced from CRM, Exly, and Artists';
        if (p.overridden) {
          info = `Manual · Auto was ${meta.format(p.auto ?? 0)}${p.target ? ` · Target: ${meta.format(p.target)}` : ''}`;
        }
        return (
          <StatCard
            key={key}
            label={p.overridden ? `${meta.label} (manual)` : meta.label}
            value={meta.format(p.current)}
            info={info}
            variant="mint"
            delta={formatGoalDelta(increment, meta)}
            className={compact ? '!p-2.5' : undefined}
          >
            <GoalSparkline history={history} metricKey={key} />
          </StatCard>
        );
      })}
    </div>
  );
}
