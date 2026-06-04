import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Badge } from '../ui';
import { UserAvatar } from '../ui/UserAvatar';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { formatTaskPriority } from '../../utils/displayLabels';
import { buildTaskAssigneeRows } from '../../utils/taskAssigneeRows';
import TaskTeamAddChip, { TEAM_CHIP_CLASS } from './TaskTeamAddChip';
import TaskHeaderDueDate from './TaskHeaderDueDate';

const metaPillClass =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] font-semibold text-[10px] shrink-0';

function AssigneeChip({ row, onRemove, canRemove }) {
  return (
    <li
      className={`${TEAM_CHIP_CLASS} border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]/90 max-w-[220px] group relative`}
      title={
        row.assignerName
          ? `${row.name} · ${row.department} · ${row.roleLabel} · Assigned by ${row.assignerName}`
          : `${row.name} · ${row.department} · ${row.roleLabel}`
      }
    >
      <UserAvatar user={row.user} name={row.name} avatar={row.avatar} size="xs" />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] truncate">{row.name}</span>
          <span
            className={`shrink-0 px-1 py-px rounded text-[7px] font-black uppercase tracking-wider ${
              row.role === 'creator'
                ? 'bg-[var(--color-action-primary)]/15 text-[var(--color-action-primary)]'
                : 'bg-[var(--color-brand-teal)]/15 text-[var(--color-brand-teal)]'
            }`}
          >
            {row.roleLabel}
          </span>
        </div>
        <p className="text-[9px] text-[var(--color-text-muted)] truncate">
          {row.department}
          {row.assignerName ? (
            <>
              <span className="mx-0.5 opacity-50">·</span>
              <span className="text-[var(--color-text-secondary)]">by {row.assignerName}</span>
            </>
          ) : null}
        </p>
      </div>
      {canRemove && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-0.5 rounded hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Remove ${row.name}`}
        >
          <X size={12} />
        </button>
      )}
    </li>
  );
}

export default function TaskDetailModalHeader({
  onClose,
  workspace,
  projectName,
  priority,
  task,
  assigneeIds = [],
  onAssigneesChange,
  directoryUsers = [],
  lockedAssigneeIds = [],
  teamEditable = true,
  dueDate = '',
  scheduleDate = '',
  taskStatus = 'todo',
  onDueDateChange,
  dueDateDisabled = false,
}) {
  const assigneeRows = useMemo(
    () => buildTaskAssigneeRows(task, assigneeIds, directoryUsers),
    [task, assigneeIds, directoryUsers]
  );

  return (
    <header className="px-4 py-2.5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] shrink-0">
      <div className="flex items-center gap-2 min-h-[2.375rem]">
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className={metaPillClass}>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Ws</span>
            {workspace || 'General'}
          </span>
          <span className={`${metaPillClass} max-w-[200px]`}>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">Prj</span>
            <span className="truncate">{projectName || 'No project'}</span>
          </span>
          <Badge variant={getPriorityBadgeVariant(priority)} className="uppercase !text-[8px] !font-black !py-0.5 !px-2 tracking-widest shrink-0">
            {formatTaskPriority(priority)}
          </Badge>
        </div>

        <span className="w-px h-5 bg-[var(--color-bg-border)] shrink-0" aria-hidden />

        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] shrink-0 hidden sm:inline">
            Team
          </span>
          <ul className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1 content-center max-h-[4.5rem] overflow-y-auto tm-modal-scroll list-none p-0 m-0">
            {assigneeRows.map((row) => {
              const isCreator = row.role === 'creator';
              const locked = isCreator
                || lockedAssigneeIds.some((id) => String(id) === String(row.userId));
              return (
                <AssigneeChip
                  key={`${row.role}-${row.userId}`}
                  row={row}
                  canRemove={teamEditable && !locked}
                  onRemove={
                    onAssigneesChange
                      ? () => onAssigneesChange(
                        assigneeIds.filter((id) => String(id) !== String(row.userId))
                      )
                      : undefined
                  }
                />
              );
            })}
            {teamEditable && onAssigneesChange && (
              <TaskTeamAddChip
                directoryUsers={directoryUsers}
                assigneeIds={assigneeIds}
                lockedAssigneeIds={lockedAssigneeIds}
                onAdd={onAssigneesChange}
              />
            )}
          </ul>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-center">
          <TaskHeaderDueDate
            dueDate={dueDate}
            scheduleDate={scheduleDate}
            status={taskStatus}
            onChange={onDueDateChange}
            disabled={dueDateDisabled}
          />
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-[var(--color-bg-border)] text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </header>
  );
}
