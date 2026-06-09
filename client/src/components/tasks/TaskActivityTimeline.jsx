import React from 'react';
import { formatActivityTime } from '../../utils/formatActivityTime';
import { UserLabel } from '../ui/UserAvatar';
import MentionTitle from '../mentions/MentionTitle';
import { DataLoading } from '../ui/DataLoading';
import { formatTaskStatus } from '../../utils/displayLabels';
import { TASK_STATUS_BUTTON_OPTIONS, taskStatusButtonClass } from '../../utils/taskStatusButtons';
import {
  FIELD_ACTIVITY_LABELS,
  formatFieldActivityValue,
} from '../../utils/taskFieldActivityLabels';

function StatusPill({ status }) {
  const value = String(status || '').toLowerCase();
  const option = TASK_STATUS_BUTTON_OPTIONS.find((o) => o.value === value);
  const label = option?.label || formatTaskStatus(value);
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${taskStatusButtonClass(value, true)}`}
    >
      {label}
    </span>
  );
}

function ActivityEvent({ item }) {
  const time = formatActivityTime(item.createdAt);

  if (item.type === 'created') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs py-1.5 border-l-2 border-[var(--color-action-primary)]/40 pl-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)]">Created</span>
        <span className="text-[var(--color-text-muted)]">·</span>
        <span className="text-[var(--color-text-muted)] shrink-0">{time}</span>
        {item.actor && (
          <UserLabel user={item.actor} name={item.actor.name} size="xs" nameClassName="text-xs font-semibold" />
        )}
      </div>
    );
  }

  if (item.type === 'assignment') {
    const assignee = item.assignee;
    const assignedBy = item.assignedBy || item.actor;
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs py-1.5 border-l-2 border-[var(--color-brand-teal)]/40 pl-3">
        <span className="text-[var(--color-text-muted)] shrink-0">{time}</span>
        <span className="text-[var(--color-text-muted)]">Assigned to</span>
        {assignee && (
          <UserLabel user={assignee} name={assignee.name} size="xs" nameClassName="text-xs font-semibold" />
        )}
        {assignedBy && (
          <>
            <span className="text-[var(--color-text-muted)]">by</span>
            <UserLabel user={assignedBy} name={assignedBy.name} size="xs" nameClassName="text-xs" />
          </>
        )}
      </div>
    );
  }

  if (item.type === 'status_change') {
    const statusFrom = String(item.statusFrom || '').toLowerCase();
    const statusTo = String(item.statusTo || item.body || '').toLowerCase();
    return (
      <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/60 p-3 space-y-1.5 border-l-4 border-l-purple-500/50">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 shrink-0">
            Status
          </span>
          <span className="text-[var(--color-text-muted)] shrink-0 tabular-nums">{time}</span>
          {item.actor && (
            <UserLabel user={item.actor} name={item.actor.name} size="xs" nameClassName="text-xs font-semibold" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--color-text-muted)]">
            {statusFrom ? 'changed status from' : 'set status to'}
          </span>
          {statusFrom ? <StatusPill status={statusFrom} /> : null}
          {statusFrom ? <span className="text-[var(--color-text-muted)]">to</span> : null}
          {statusTo ? <StatusPill status={statusTo} /> : null}
        </div>
      </div>
    );
  }

  if (item.type === 'field_change') {
    const fieldKey = item.fieldKey || '';
    const fieldLabel = FIELD_ACTIVITY_LABELS[fieldKey] || fieldKey;
    const valueFrom = item.valueFrom ?? '';
    const valueTo = item.valueTo ?? '';
    return (
      <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/60 p-3 space-y-1.5 border-l-4 border-l-amber-500/50">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
            {fieldLabel}
          </span>
          <span className="text-[var(--color-text-muted)] shrink-0 tabular-nums">{time}</span>
          {item.actor && (
            <UserLabel user={item.actor} name={item.actor.name} size="xs" nameClassName="text-xs font-semibold" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-primary)]">
          <span className="text-[var(--color-text-muted)]">
            {valueFrom ? 'changed from' : 'set to'}
          </span>
          {valueFrom ? (
            <span className="font-semibold">{formatFieldActivityValue(fieldKey, valueFrom)}</span>
          ) : null}
          {valueFrom ? <span className="text-[var(--color-text-muted)]">to</span> : null}
          <span className="font-semibold">{formatFieldActivityValue(fieldKey, valueTo)}</span>
        </div>
      </div>
    );
  }

  if (item.type === 'rollback') {
    return (
      <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/60 p-3 space-y-1.5 border-l-4 border-l-rose-500/50">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 shrink-0">
            Rolled back
          </span>
          <span className="text-[var(--color-text-muted)] shrink-0 tabular-nums">{time}</span>
          {item.actor && (
            <UserLabel user={item.actor} name={item.actor.name} size="xs" nameClassName="text-xs font-semibold" />
          )}
        </div>
        {item.body ? (
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
            <span className="text-[var(--color-text-muted)]">Reason: </span>
            <MentionTitle text={item.body} />
          </p>
        ) : null}
      </div>
    );
  }

  if (item.type === 'message') {
    return (
      <div className="rounded-lg border border-[var(--color-bg-border)] p-3 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {item.actor && (
            <UserLabel user={item.actor} name={item.actor.name} size="xs" nameClassName="text-xs font-bold" />
          )}
          <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{time}</span>
        </div>
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
          <MentionTitle text={item.body} />
        </p>
      </div>
    );
  }

  return null;
}

export default function TaskActivityTimeline({ items = [], isLoading }) {
  if (isLoading) {
    return (
      <div className="py-6">
        <DataLoading />
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">No activity yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActivityEvent key={item._id} item={item} />
      ))}
    </div>
  );
}
