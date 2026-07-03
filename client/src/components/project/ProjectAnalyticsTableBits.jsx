import React from 'react';

const HOURS_BAR_COLORS = {
  manual: 'bg-[var(--color-pastel-mint-text)]',
  task: 'bg-[var(--color-pastel-apricot-text)]',
};

export const HoursMixBar = ({ totalHours, manualLogHours, taskCompletionHours }) => {
  const total = totalHours || 0;
  if (total <= 0) {
    return (
      <div className="space-y-1">
        <span className="tabular-nums text-xs">0.0</span>
        <div className="h-1 rounded-full bg-[var(--color-bg-border)]" title="Manual + task hours = total" />
      </div>
    );
  }
  const manualPct = Math.min(100, (manualLogHours / total) * 100);
  const taskPct = Math.min(100 - manualPct, (taskCompletionHours / total) * 100);

  return (
    <div className="space-y-1 min-w-[72px]">
      <span className="tabular-nums text-xs font-semibold">{total.toFixed(1)}</span>
      <div
        className="h-1.5 rounded-full bg-[var(--color-bg-border)] overflow-hidden flex"
        title={`Manual ${manualLogHours.toFixed(1)}h + Task ${taskCompletionHours.toFixed(1)}h = ${total.toFixed(1)}h`}
      >
        {manualPct > 0 && (
          <div className={`h-full ${HOURS_BAR_COLORS.manual}`} style={{ width: `${manualPct}%` }} />
        )}
        {taskPct > 0 && (
          <div className={`h-full ${HOURS_BAR_COLORS.task}`} style={{ width: `${taskPct}%` }} />
        )}
      </div>
      <p className="text-[9px] text-[var(--color-text-muted)] tabular-nums">
        {manualLogHours.toFixed(1)} + {taskCompletionHours.toFixed(1)}
      </p>
    </div>
  );
};

const BUDGET_TONE_CLASS = {
  ok: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  neutral: 'text-[var(--color-text-muted)]',
};

export const budgetStatusTone = (pct) => {
  if (pct == null) return 'neutral';
  if (pct >= 100) return 'danger';
  if (pct >= 75) return 'warning';
  return 'ok';
};

export const BudgetUsedCell = ({ budgetUsedPct, hasBudget }) => {
  if (!hasBudget || budgetUsedPct == null) {
    return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>;
  }
  const tone = budgetStatusTone(budgetUsedPct);
  return (
    <span
      className={`text-xs font-bold tabular-nums ${BUDGET_TONE_CLASS[tone]}`}
      title="All-time spend ÷ budget from finance docs"
    >
      {budgetUsedPct.toFixed(0)}%
    </span>
  );
};

export const ProgressCell = ({ progress, completedTasks, totalTasks }) => {
  const hasDenominator = totalTasks > 0;
  return (
    <div className="min-w-[64px]" title={hasDenominator ? `${completedTasks} of ${totalTasks} tasks complete` : 'No tasks on project'}>
      <span className="text-xs font-semibold tabular-nums">{progress}%</span>
      {hasDenominator && (
        <p className="text-[9px] text-[var(--color-text-muted)] tabular-nums">
          {completedTasks}/{totalTasks} tasks
        </p>
      )}
    </div>
  );
};

export const formatProjectInr = (value, { emptyLabel = '—' } = {}) => {
  const num = Number(value);
  if (value == null || Number.isNaN(num) || num === 0) return emptyLabel;
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const formatBudgetDisplay = (hasBudget, budget) => {
  if (!hasBudget || budget == null) return 'No budget set';
  return formatProjectInr(budget, { emptyLabel: 'No budget set' });
};

export const formatVarianceHours = (varianceHours) => {
  const v = Number(varianceHours) || 0;
  if (v === 0) return '0h';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}h`;
};

export const formatForeignSpendNote = (foreignSpendInRange = []) => {
  const items = (foreignSpendInRange || []).filter((e) => e.currency && e.currency !== 'INR');
  if (!items.length) return null;
  return items.map((e) => `${e.currency} ${Number(e.amount).toLocaleString('en-IN')}`).join(', ');
};
