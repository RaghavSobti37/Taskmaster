import React, { useState } from 'react';
import { X, CheckCircle2, Plus } from 'lucide-react';
import { ModalShell, ModalFooter } from './ui/ModalShell';
import { useAuth } from '../contexts/AuthContext';
import { useCreateTask, useProjects } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory } from '../constants/taskOptions';
import { computeDueDateFromStart, todayDateString } from '../utils/taskPriorityDates';
import { validateTaskTimelineFields } from '../utils/dateValidation';
import TaskFormFields from './forms/TaskFormFields';
import { suppressAutoToasts } from '../lib/notifications';
import { useSystemToast } from '../lib/systemLogBridge';

const TaskCreateModal = ({ isOpen, onClose, projectId: initialProjectId, members: passedMembers, projects: passedProjects, onTaskCreated }) => {
  const { user } = useAuth();
  const createTaskMutation = useCreateTask();
  const { addToast } = useSystemToast();

  const { data: fetchedProjects = [] } = useProjects();
  const projects = passedProjects || fetchedProjects;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const initialFormValues = () => {
    const scheduleDate = todayDateString();
    return {
      priority: 'medium',
      projectId: initialProjectId || '',
      workspace: 'General',
      assignees: user ? [user._id] : [],
      scheduleDate,
      dueDate: computeDueDateFromStart(scheduleDate, 'medium'),
      dueDateManual: false,
      scheduleSlot: 'FULL',
      type: '',
    };
  };

  const [formValues, setFormValues] = useState(initialFormValues);

  React.useEffect(() => {
    if (isOpen) {
      const project = projects.find((p) => p._id === (initialProjectId || ''));
      setTitle('');
      setDesc('');
      setFormValues({
        ...initialFormValues(),
        projectId: initialProjectId || '',
        workspace: project?.workspace || 'General',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const timelineCheck = validateTaskTimelineFields({
      scheduleDate: formValues.scheduleDate,
      dueDate: formValues.dueDate,
    });
    if (!timelineCheck.ok) {
      addToast({ type: 'error', message: timelineCheck.error });
      return;
    }

    suppressAutoToasts(5000);
    const payload = {
      title,
      description: desc,
      priority: formValues.priority,
      type: normalizeTaskCategory(formValues.type),
      workspace: formValues.workspace,
      scheduleDate: formValues.scheduleDate || null,
      scheduleSlot: formValues.scheduleSlot,
      projectId: formValues.projectId || null,
      assignees: formValues.assignees,
      dueDate: formValues.dueDate || null,
      status: 'todo',
    };

    createTaskMutation.mutate(payload, {
      onSuccess: (created) => {
        if (onTaskCreated) onTaskCreated(created);
      },
    });
    onClose();
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100}>
      <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)] shrink-0">
        <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Plus size={18} className="text-[var(--color-action-primary)]" />
          Create New Task
        </h3>
        <button type="button" onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
          <X size={20} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="tm-modal-scroll p-6 space-y-4">
          <TaskFormFields
            values={formValues}
            onChange={setFormValues}
            projects={projects}
            members={passedMembers}
            showProject={!initialProjectId}
            lockProject={!!initialProjectId}
            showStatus={false}
            showTitle
            showDescription
            title={title}
            onTitleChange={setTitle}
            description={desc}
            onDescriptionChange={setDesc}
            lockedAssigneeIds={user?._id ? [user._id] : []}
            mentionSessionKey={isOpen ? 'create' : undefined}
          />
        </div>

        <ModalFooter className="justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-bold text-[var(--color-text-muted)]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="bg-[var(--color-action-primary)] text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 size={18} /> Create Task
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

export default TaskCreateModal;
