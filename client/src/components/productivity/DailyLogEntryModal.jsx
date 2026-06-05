import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw, Target } from 'lucide-react';
import { Button, Input, NexusDropdown } from '../ui';
import { NexusModal } from '../ui/modals';
import WorkspaceProjectFields from '../forms/WorkspaceProjectFields';
import { useCreateLog, useProjects } from '../../hooks/useTaskmasterQueries';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h <= 4; h += 1) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 0 && m === 0) continue;
      opts.push(h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`);
    }
  }
  return opts;
})();

export default function DailyLogEntryModal({ isOpen, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('General');
  const [selectedProject, setSelectedProject] = useState('');
  const { data: projects = [] } = useProjects();
  const createLogMutation = useCreateLog();
  const { addToast } = useSystemToast();

  const timeDropdownOptions = useMemo(
    () => TIME_OPTIONS.map((opt) => ({ value: opt, label: opt })),
    []
  );

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTimeSpent('');
    setSelectedWorkspace('General');
    setSelectedProject('');
  };

  const handleClose = () => {
    if (createLogMutation.isPending) return;
    resetForm();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const projectRecord = projects.find((p) => p._id === selectedProject);
    createLogMutation.mutate(
      {
        action: 'DAILY_LOG',
        details: {
          title,
          message: description,
          timeSpent,
          workspace: selectedWorkspace || projectRecord?.workspace || 'General',
          project: projectRecord?.name || 'General',
        },
        targetId: selectedProject || null,
        targetType: selectedProject ? 'Project' : 'System',
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
          addToast({
            title: 'Log saved',
            message: "Daily log entry added — XP awarded if under today's cap.",
            type: 'success',
            module: MODULE.SYSTEM,
          });
        },
      }
    );
  };

  return (
    <NexusModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Log Your Work"
      showFooter={false}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="What did you work on?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task name or summary"
          icon={Target}
          required
        />
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
            Time Spent
          </label>
          <NexusDropdown
            options={timeDropdownOptions}
            value={timeSpent}
            onChange={setTimeSpent}
            placeholder="Select time"
          />
        </div>
        <WorkspaceProjectFields
          projects={projects}
          workspace={selectedWorkspace}
          projectId={selectedProject}
          onChange={({ workspace, projectId }) => {
            setSelectedWorkspace(workspace);
            setSelectedProject(projectId);
          }}
          layout="inline"
          allowEmptyProject
          emptyProjectLabel="None"
        />
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-medium outline-none min-h-[120px] focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
            placeholder="Any extra details..."
          />
        </div>
        <Button type="submit" className="w-full" disabled={createLogMutation.isPending || !title.trim()}>
          {createLogMutation.isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <>
              <Plus size={14} /> Log Work
            </>
          )}
        </Button>
      </form>
    </NexusModal>
  );
}
