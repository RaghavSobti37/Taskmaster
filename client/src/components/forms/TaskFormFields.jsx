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
}) => {
  const set = (field, val) => onChange({ ...values, [field]: val });

  const handleProjectChange = (projectId) => {
    const project = projects.find((p) => p._id === projectId);
    const next = { ...values, projectId };
    if (project?.workspace) next.workspace = project.workspace;
    onChange(next);
  };

  const categoryValue = normalizeTaskCategory(values.type);

  return (
    <div className="space-y-4 w-full min-w-0">
      {showProject && !lockProject && (
        <ProjectSelect
          projects={projects}
          value={values.projectId || ''}
          onChange={handleProjectChange}
          workspaceFilter={values.workspace || null}
          disabled={disabled}
        />
      )}

      {showWorkspace && (
        <WorkspaceSelect
          value={values.workspace || 'General'}
          onChange={(workspace) => set('workspace', workspace)}
          disabled={disabled}
        />
      )}

      {showAssignees && (
        <MemberSelect
          members={members}
          value={values.assignees || []}
          onChange={(assignees) => set('assignees', assignees)}
          disabled={disabled}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full [&>*]:min-w-0">
        {showStatus && (
          <StatusSelect value={values.status} onChange={(status) => set('status', status)} disabled={disabled} />
        )}
        <PrioritySelect value={values.priority} onChange={(priority) => set('priority', priority)} disabled={disabled} />
      </div>

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
              value={values.scheduleSlot || 'AM'}
              onChange={(scheduleSlot) => set('scheduleSlot', scheduleSlot)}
              disabled={disabled || timelineDisabled}
            />
            <div className="w-full min-w-0">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Schedule Date
              </label>
              <input
                type="date"
                value={values.scheduleDate || ''}
                disabled={disabled || timelineDisabled}
                onChange={(e) => set('scheduleDate', e.target.value)}
                className="block w-full min-w-0 min-h-[2.5rem] px-3 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] disabled:opacity-60 text-sm"
              />
            </div>
          </div>
          <div className="w-full min-w-0">
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={values.dueDate || ''}
              disabled={disabled || timelineDisabled}
              onChange={(e) => set('dueDate', e.target.value)}
              className="block w-full min-w-0 min-h-[2.5rem] px-3 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] disabled:opacity-60 text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default TaskFormFields;
