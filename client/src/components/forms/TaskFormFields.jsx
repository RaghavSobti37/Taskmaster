import React from 'react';
import WorkspaceSelect from './WorkspaceSelect';
import ProjectSelect from './ProjectSelect';
import MemberSelect from './MemberSelect';
import StatusSelect from './StatusSelect';
import PrioritySelect from './PrioritySelect';
import TaskCategorySelect from './TaskCategorySelect';
import NexusDropdown from '../ui/NexusDropdown';
import { SLOT_OPTIONS } from '../../constants/taskOptions';
import { normalizeTaskCategory } from '../../constants/taskOptions';
import { computeDueDateFromStart, todayDateString } from '../../utils/taskPriorityDates';

const fieldLabelClass = 'block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2';
const fieldInputClass =
  'block w-full min-w-0 min-h-[2.5rem] px-3 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] disabled:opacity-60 text-sm outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/30';

const TaskFormFields = ({
  values,
  onChange,
  projects = [],
  members,
  showProject = true,
  showWorkspace = true,
  showStatus = false,
  showAssignees = true,
  showSchedule = true,
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
}) => {
  const set = (field, val) => onChange({ ...values, [field]: val });

  const resolveStartDate = () => values.scheduleDate || todayDateString();

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
    onChange(syncDueFromPriorityStart({ ...values, scheduleDate: scheduleDate || todayDateString() }));
  };

  const handleDueDateChange = (dueDate) => {
    onChange({ ...values, dueDate, dueDateManual: true });
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

      {showTitle && onTitleChange && (
        <div className="w-full min-w-0">
          <label className={fieldLabelClass}>Task Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={disabled}
            className={`${fieldInputClass} font-bold`}
            placeholder="What needs to be done?"
            required
          />
        </div>
      )}

      {showDescription && onDescriptionChange && (
        <div className="w-full min-w-0">
          <label className={fieldLabelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={disabled}
            className={`${fieldInputClass} min-h-[88px] resize-y`}
            placeholder="Add details..."
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

      {!showAssignees && (
        <PrioritySelect
          value={values.priority}
          onChange={handlePriorityChange}
          disabled={disabled}
        />
      )}

      {showStatus && (
        <StatusSelect value={values.status} onChange={(status) => set('status', status)} disabled={disabled} />
      )}

      <TaskCategorySelect
        label="Category"
        value={categoryValue}
        onChange={(type) => set('type', type)}
        disabled={disabled}
      />

      {showSchedule && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full [&>*]:min-w-0">
            <NexusDropdown
              label="Slot"
              options={SLOT_OPTIONS}
              value={values.scheduleSlot || 'FULL'}
              onChange={(scheduleSlot) => set('scheduleSlot', scheduleSlot)}
              disabled={disabled || timelineDisabled}
            />
            <div className="w-full min-w-0">
              <label className={fieldLabelClass}>Start Date</label>
              <input
                type="date"
                value={values.scheduleDate || ''}
                disabled={disabled || timelineDisabled}
                onChange={(e) => handleScheduleDateChange(e.target.value)}
                className={fieldInputClass}
              />
            </div>
          </div>
          <div className="w-full min-w-0">
            <label className={fieldLabelClass}>Due Date</label>
            <input
              type="date"
              value={values.dueDate || ''}
              disabled={disabled || timelineDisabled}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className={fieldInputClass}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default TaskFormFields;
