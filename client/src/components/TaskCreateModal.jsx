import React, { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from './ui/modals';
import { Button } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { useCreateTask, useProjects, useUserDirectory } from '../hooks/useTaskmasterQueries';
import { normalizeTaskCategory } from '../constants/taskOptions';
import { computeDueDateFromStart, todayDateString } from '../utils/taskPriorityDates';
import { validateTaskTimelineFields } from '../utils/dateValidation';
import TaskFormFields from './forms/TaskFormFields';
import { suppressAutoToasts } from '../lib/notifications';
import { useSystemToast } from '../lib/systemLogBridge';
import { mergeMentionedUserIdsIntoAssignees } from '../utils/mentionTokens';

const TaskCreateModal = ({ isOpen, onClose, projectId: initialProjectId, projects: passedProjects, onTaskCreated }) => {
  const { user } = useAuth();
  const createTaskMutation = useCreateTask();
  const { addToast } = useSystemToast();

  const { data: fetchedProjects = [] } = useProjects();
  const { data: directoryUsers = [] } = useUserDirectory(isOpen);
  const projects = passedProjects || fetchedProjects;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const initialFormValues = () => {
    const scheduleDate = todayDateString();
    return {
      priority: 'medium',
      projectId: initialProjectId || '',
      workspace: 'General',
      assignees: [],
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
      assignees: mergeMentionedUserIdsIntoAssignees(
        formValues.assignees,
        directoryUsers,
        title,
        desc
      ).filter((id) => id !== user?._id),
      dueDate: formValues.dueDate || null,
      status: 'todo',
    };

    createTaskMutation.mutate(payload, {
      onSuccess: (created) => {
        if (onTaskCreated) onTaskCreated(created);
        onClose();
      },
      onError: (err) => {
        addToast({
          type: 'error',
          message: err.response?.data?.error || err.response?.data?.message || 'Could not create task',
        });
      },
    });
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100} ariaLabel="Create new task">
      <ModalHeader
        title="Create New Task"
        onClose={onClose}
        icon={Plus}
        iconStyle={{ color: 'var(--color-action-primary)' }}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody>
          <TaskFormFields
            values={formValues}
            onChange={setFormValues}
            projects={projects}
            members={directoryUsers}
            excludeAssigneeUserId={user?._id}
            showProject={!initialProjectId}
            lockProject={!!initialProjectId}
            showStatus={false}
            showTitle
            showDescription
            title={title}
            onTitleChange={setTitle}
            description={desc}
            onDescriptionChange={setDesc}
            mentionSessionKey={isOpen ? 'create' : undefined}
          />
        </ModalBody>

        <ModalFooter className="justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!title.trim() || createTaskMutation.isPending}
          >
            <CheckCircle2 size={18} /> Create Task
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

export default TaskCreateModal;
