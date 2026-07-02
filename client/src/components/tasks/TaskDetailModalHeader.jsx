import React, { useMemo } from 'react';
import { X, Copy } from 'lucide-react';
import { Badge } from '../ui';
import { UserAvatar } from '../ui/UserAvatar';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';
import { formatTaskPriority } from '../../utils/displayLabels';
import { buildTaskAssigneeRows } from '../../utils/taskAssigneeRows';
import { formatActivityTime } from '../../utils/formatActivityTime';
import TaskTeamAddChip, { TEAM_CHIP_CLASS } from './TaskTeamAddChip';
import TaskHeaderDueDate from './TaskHeaderDueDate';
import { resolveTaskId } from '../../utils/taskCompletion';

const metaPillClass =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] font-semibold text-[10px] shrink-0';

const TEAM_VISIBLE_CAP = 4;
const MOBILE_AVATAR_STACK_CAP = 3;

const avatarRingClass = 'ring-2 ring-[var(--color-bg-workspace)]';

function TeamAvatarStack({
  assigneeRows,
  assigneeIds,
  assigneesChangeProps,
  teamEditable,
  lockedAssigneeIds,
}) {
  const { directoryUsers, onAssigneesChange } = assigneesChangeProps;
  const visibleRows = assigneeRows.slice(0, MOBILE_AVATAR_STACK_CAP);
  const overflowCount = Math.max(0, assigneeRows.length - MOBILE_AVATAR_STACK_CAP);
  const allNames = assigneeRows.map((r) => r.name).join(', ');

  return (
    <div className="flex items-center min-w-0" title={allNames || undefined}>
      <ul className="flex items-center list-none p-0 m-0">
        {visibleRows.map((row, index) => (
          <li
            key={`${row.role}-${row.userId}`}
            className={`relative ${index > 0 ? '-ml-2' : ''}`}
            style={{ zIndex: visibleRows.length - index }}
            title={
              row.assignerName
                ? `${row.name} · ${row.roleLabel} · Assigned by ${row.assignerName}`
                : `${row.name} · ${row.roleLabel}`
            }
          >
            <UserAvatar
              user={row.user}
              name={row.name}
              avatar={row.avatar}
              size="sm"
              className={avatarRingClass}
            />
          </li>
        ))}
        {overflowCount > 0 && (
          <li className="-ml-2 relative z-0" title={assigneeRows.slice(MOBILE_AVATAR_STACK_CAP).map((r) => r.name).join(', ')}>
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[10px] font-bold text-[var(--color-text-secondary)] ${avatarRingClass}`}
            >
              +{overflowCount}
            </span>
          </li>
        )}
        {teamEditable && onAssigneesChange && (
          <TaskTeamAddChip
            variant="stack"
            directoryUsers={directoryUsers}
            assigneeIds={assigneeIds}
            lockedAssigneeIds={lockedAssigneeIds}
            onAdd={onAssigneesChange}
          />
        )}
      </ul>
    </div>
  );
}

function AssigneeChip({ row, onRemove, canRemove }) {
  return (
    <li
      className={`${TEAM_CHIP_CLASS} border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]/90 max-w-full md:max-w-[220px] group relative shrink-0`}
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
        <p
          className={`text-[9px] text-[var(--color-text-muted)] tabular-nums ${
            row.role === 'creator' ? 'whitespace-normal break-words md:truncate' : 'truncate'
          }`}
        >
          {row.role === 'creator' ? (
            <>
              <span>{row.department}</span>
              {row.createdAt ? (
                <>
                  <span className="mx-0.5 opacity-50">·</span>
                  <span className="block md:inline mt-0.5 md:mt-0">{formatActivityTime(row.createdAt)}</span>
                </>
              ) : null}
            </>
          ) : (
            <>
              {row.department}
              {row.assignerName ? (
                <>
                  <span className="mx-0.5 opacity-50">·</span>
                  <span className="text-[var(--color-text-secondary)]">by {row.assignerName}</span>
                </>
              ) : null}
            </>
          )}
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

function MetaPills({ workspace, projectName, priority }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
      <span className={metaPillClass}>
        <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Ws</span>
        <span className="truncate max-w-[140px] md:max-w-none">{workspace || 'General'}</span>
      </span>
      <span className={`${metaPillClass} max-w-[200px]`}>
        <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">Prj</span>
        <span className="truncate">{projectName || 'No project'}</span>
      </span>
      <Badge variant={getPriorityBadgeVariant(priority)} className="uppercase !text-[8px] !font-black !py-0.5 !px-2 tracking-widest shrink-0">
        {formatTaskPriority(priority)}
      </Badge>
    </div>
  );
}

function OverflowChip({ count, names }) {
  return (
    <li
      className={`${TEAM_CHIP_CLASS} border-dashed border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/80 shrink-0 cursor-default`}
      title={names.join(', ')}
    >
      <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">+{count} people</span>
    </li>
  );
}

function TeamList({
  assigneeRows,
  assigneeIds,
  assigneesChangeProps,
  teamEditable,
  lockedAssigneeIds,
  listClassName = '',
  compactOverflow = false,
}) {
  const { directoryUsers, onAssigneesChange } = assigneesChangeProps;
  const visibleRows = compactOverflow ? assigneeRows.slice(0, TEAM_VISIBLE_CAP) : assigneeRows;
  const overflowRows = compactOverflow ? assigneeRows.slice(TEAM_VISIBLE_CAP) : [];

  return (
    <ul className={`flex items-center gap-1.5 min-w-0 list-none p-0 m-0 ${listClassName}`.trim()}>
      {visibleRows.map((row) => {
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
      {overflowRows.length > 0 && (
        <OverflowChip count={overflowRows.length} names={overflowRows.map((r) => r.name)} />
      )}
      {teamEditable && onAssigneesChange && (
        <TaskTeamAddChip
          directoryUsers={directoryUsers}
          assigneeIds={assigneeIds}
          lockedAssigneeIds={lockedAssigneeIds}
          onAdd={onAssigneesChange}
        />
      )}
    </ul>
  );
}

function TaskIdRow({ task }) {
  const taskId = resolveTaskId(task);
  const displayId = taskId ? String(taskId).slice(-6).toUpperCase() : '—';

  const handleCopy = () => {
    if (!taskId || typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(String(taskId));
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        Task
      </span>
      <span className="text-[10px] font-bold text-[var(--color-text-secondary)] tabular-nums">
        #{displayId}
      </span>
      {taskId && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Copy task ID"
          title="Copy task ID"
        >
          <Copy size={12} />
        </button>
      )}
    </div>
  );
}

function DueRow({
  dueDate,
  scheduleDate,
  taskStatus,
  onDueDateChange,
  dueDateDisabled,
  className = '',
}) {
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`.trim()}>
      <TaskHeaderDueDate
        dueDate={dueDate}
        scheduleDate={scheduleDate}
        status={taskStatus}
        onChange={onDueDateChange}
        disabled={dueDateDisabled}
      />
    </div>
  );
}

function CloseButton({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-[var(--color-bg-border)] text-[var(--color-text-primary)] transition-colors shrink-0"
      aria-label="Close"
    >
      <X size={20} strokeWidth={2.25} />
    </button>
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

  const teamProps = {
    directoryUsers,
    onAssigneesChange,
  };

  return (
    <header className="px-3 md:px-4 py-2.5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] shrink-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 min-w-0">
        <MetaPills workspace={workspace} projectName={projectName} priority={priority} />
        <DueRow
          dueDate={dueDate}
          scheduleDate={scheduleDate}
          taskStatus={taskStatus}
          onDueDateChange={onDueDateChange}
          dueDateDisabled={dueDateDisabled}
          className="max-w-full"
        />
      </div>

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <TaskIdRow task={task} />
          <span className="hidden md:block w-px h-5 bg-[var(--color-bg-border)] shrink-0" aria-hidden />
          <div className="flex-1 min-w-0 md:hidden">
            <TeamAvatarStack
              assigneeRows={assigneeRows}
              assigneeIds={assigneeIds}
              assigneesChangeProps={teamProps}
              teamEditable={teamEditable}
              lockedAssigneeIds={lockedAssigneeIds}
            />
          </div>
          <div className="hidden md:flex flex-1 min-w-0 overflow-x-auto tm-modal-scroll">
            <TeamList
              assigneeRows={assigneeRows}
              assigneeIds={assigneeIds}
              assigneesChangeProps={teamProps}
              teamEditable={teamEditable}
              lockedAssigneeIds={lockedAssigneeIds}
              listClassName="flex-nowrap w-max max-w-full pr-1"
              compactOverflow
            />
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>
    </header>
  );
}
