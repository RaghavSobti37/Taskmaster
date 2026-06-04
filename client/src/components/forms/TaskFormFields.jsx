import React from 'react';
import WorkspaceSelect from './WorkspaceSelect';
import ProjectSelect from './ProjectSelect';
import MemberSelect from './MemberSelect';
import StatusSelect from './StatusSelect';
import PrioritySelect from './PrioritySelect';
import TaskCategorySelect from './TaskCategorySelect';
import NexusDropdown from '../ui/NexusDropdown';
import MentionTextarea from '../mentions/MentionTextarea';
import MentionInput from '../mentions/MentionInput';
import { SLOT_OPTIONS } from '../../constants/taskOptions';
import { normalizeTaskCategory } from '../../constants/taskOptions';
import { computeDueDateFromStart } from '../../utils/taskPriorityDates';
import { getTodayDateKey, validateTaskTimelineFields } from '../../utils/dateValidation';

const fieldLabelClass = 'block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2';
const fieldInputClass =
  'block w-full min-w-0 min-h-[2.5rem] px-3 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] disabled:opacity-60 text-sm outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/30';
const ghostInputClass =
  'block w-full min-w-0 min-h-[2.5rem] px-3 py-2 rounded-[var(--radius-atomic)] border border-transparent bg-transparent hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-surface)] focus:ring-1 focus:ring-[var(--color-bg-border)] disabled:opacity-60 text-sm outline-none';

const TaskFormFields = ({
  values,
  onChange,
  projects = [],
  members,
  showProject = true,
  showWorkspace = true,
  showStatus = false,
  showAssignees = true,
  showPriority = true,
  showSchedule = true,
  showDueDateInForm = true,
  disabled = false,
  timelineDisabled = false,
  lockProject = false,
  title = '',
  onTitleChange,
  description = '',
  onDescriptionChange,
  showTitle = false,
  showDescription = false,
  lockedAssigneeIds = [],
  mentionSessionKey,
  inlineEdit = false,
  afterTitle = null,
  collapseCategoryWhenSelected = false,
}) => {
  const inputClass = inlineEdit ? ghostInputClass : fieldInputClass;
  const set = (field, val) => onChange({ ...values, [field]: val });
  const todayKey = getTodayDateKey();

  const resolveStartDate = () => values.scheduleDate || todayKey;

  const clampDateKey = (value, floor = todayKey) => {
    if (!value) return floor;
    return value < floor ? floor : value;
  };

  const syncDueFromPriorityStart = (nextValues, { clearManualOverride = true } = {}) => {
    const start = nextValues.scheduleDate || resolveStartDate();
    return {
      ...nextValues,
      dueDate: computeDueDateFromStart(start, nextValues.priority),
      ...(clearManualOverride ? { dueDateManual: false } : {}),
    };
  };

  const handlePriorityChange = (priority) => {
    onChange(syncDueFromPriorityStart({ ...values, priority }));
  };

  const handleScheduleDateChange = (scheduleDate) => {
    const nextDate = clampDateKey(scheduleDate || todayKey);
    onChange(syncDueFromPriorityStart({ ...values, scheduleDate: nextDate }));
  };

  const handleDueDateChange = (dueDate) => {
    const floor = values.scheduleDate && values.scheduleDate >= todayKey ? values.scheduleDate : todayKey;
    const nextDue = clampDateKey(dueDate, floor);
    onChange({ ...values, dueDate: nextDue, dueDateManual: true });
  };

  const handleWorkspaceChange = (workspace) => {
    const ws = String(workspace || 'General').toUpperCase();
    const inWorkspace = (p) => String(p.workspace || 'General').toUpperCase() === ws;
    const projectStillValid =
      !values.projectId || projects.some((p) => p._id === values.projectId && inWorkspace(p));
    onChange({
      ...values,
      workspace,
      projectId: projectStillValid ? values.projectId : '',
    });
  };

  const handleProjectChange = (projectId) => {
    const project = projects.find((p) => p._id === projectId);
    const next = { ...values, projectId };
    if (project?.workspace) next.workspace = project.workspace;
    onChange(next);
  };

  const categoryValue = normalizeTaskCategory(values.type);

  return (
    <div className="space-y-4 w-full min-w-0">
      {showTitle && onTitleChange && (
        <div className="w-full min-w-0">
          <label className={fieldLabelClass}>Task Title</label>
          <MentionInput
            value={title}
            onChange={onTitleChange}
            disabled={disabled}
            editSessionKey={mentionSessionKey}
            className={`${inputClass} font-bold`}
            placeholder="What needs to be done? @name #Asset"
          />
        </div>
      )}

      {afterTitle}

      {(showWorkspace || (showProject && !lockProject)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full [&>*]:min-w-0">
          {showWorkspace && (
            <WorkspaceSelect
              value={values.workspace || 'General'}
              onChange={handleWorkspaceChange}
              disabled={disabled}
            />
          )}
          {showProject && !lockProject && (
            <ProjectSelect
              label="Projects"
              projects={projects}
              value={values.projectId || ''}
              onChange={handleProjectChange}
              workspaceFilter={values.workspace || null}
              disabled={disabled}
            />
          )}
        </div>
      )}

      {showDescription && onDescriptionChange && (
        <div className="w-full min-w-0">
          <label className={fieldLabelClass}>Message</label>
          <MentionTextarea
            value={description}
            onChange={onDescriptionChange}
            disabled={disabled}
            editSessionKey={mentionSessionKey}
            className={`${inputClass} min-h-[88px] resize-y`}
            placeholder="Type an update, then Save — it posts to History on the task and clears for your next message. @name notifies teammates."
          />
        </div>
      )}

      {showAssignees && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full [&>*]:min-w-0">
          <MemberSelect
            members={members}
            value={values.assignees || []}
            onChange={(assignees) => set('assignees', assignees)}
            disabled={disabled}
            lockedIds={lockedAssigneeIds}
          />
          <PrioritySelect
            value={values.priority}
            onChange={handlePriorityChange}
            disabled={disabled}
          />
        </div>
      )}

      {!showAssignees && showPriority && (
        <PrioritySelect
          value={values.priority}
          onChange={handlePriorityChange}
          disabled={disabled}
        />
      )}

      {showStatus && (
        <StatusSelect value={values.status} onChange={(status) => set('status', status)} disabled={disabled} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full [&>*]:min-w-0">
        <TaskCategorySelect
          label="Category"
          value={categoryValue}
          onChange={(type) => set('type', type)}
          disabled={disabled}
          collapseWhenSelected={collapseCategoryWhenSelected}
        />
        {showSchedule && (
          <NexusDropdown
            label="Slot"
            options={SLOT_OPTIONS}
            value={values.scheduleSlot || 'FULL'}
            onChange={(scheduleSlot) => set('scheduleSlot', scheduleSlot)}
            disabled={disabled || timelineDisabled}
          />
        )}
      </div>

      {showSchedule && (
        <div
          className={
            showDueDateInForm
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 w-full [&>*]:min-w-0'
              : 'w-full min-w-0'
          }
        >
          <div className="w-full min-w-0">
            <label className={fieldLabelClass}>Start Date</label>
            <input
              type="date"
              min={todayKey}
              value={values.scheduleDate || ''}
              disabled={disabled || timelineDisabled}
              onChange={(e) => handleScheduleDateChange(e.target.value)}
              className={inputClass}
            />
          </div>
          {showDueDateInForm && (
            <div className="w-full min-w-0">
              <label className={fieldLabelClass}>End Date</label>
              <input
                type="date"
                min={values.scheduleDate && values.scheduleDate >= todayKey ? values.scheduleDate : todayKey}
                value={values.dueDate || ''}
                disabled={disabled || timelineDisabled}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskFormFields;
