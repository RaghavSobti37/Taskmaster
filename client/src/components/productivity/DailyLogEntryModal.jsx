import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Target, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Button, Input } from '../ui';
import { NexusModal } from '../ui/modals';
import WorkspaceProjectFields from '../forms/WorkspaceProjectFields';
import MemberSelect from '../forms/MemberSelect';
import { useCreateLog, useProjects } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { normalizeWorkDate } from '../../utils/dailyLogDetails';

export default function DailyLogEntryModal({ isOpen, onClose, defaultWorkDate }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('General');
  const [selectedProject, setSelectedProject] = useState('');
  const [memberIds, setMemberIds] = useState([]);
  const { data: projects = [] } = useProjects();
  const createLogMutation = useCreateLog();
  const { addToast } = useSystemToast();

  const todayKey = useMemo(() => normalizeWorkDate(new Date()), []);

  useEffect(() => {
    if (!isOpen) return;
    const base = defaultWorkDate
      ? normalizeWorkDate(defaultWorkDate)
      : todayKey;
    setWorkDate(base || todayKey);
  }, [isOpen, defaultWorkDate, todayKey]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime('');
    setEndTime('');
    setSelectedWorkspace('General');
    setSelectedProject('');
    setMemberIds([]);
  };

  const handleClose = () => {
    if (createLogMutation.isPending) return;
    resetForm();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!startTime || !endTime) return;

    const projectRecord = projects.find((p) => p._id === selectedProject);
    createLogMutation.mutate(
      {
        action: 'DAILY_LOG',
        details: {
          title,
          message: description,
          startTime,
          endTime,
          workDate,
          workspace: selectedWorkspace || projectRecord?.workspace || 'General',
          project: projectRecord?.name || 'General',
          memberIds,
        },
        targetId: selectedProject || null,
        targetType: selectedProject ? 'Project' : 'System',
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
          const shared = memberIds.length
            ? ` Shared with ${memberIds.length} teammate${memberIds.length === 1 ? '' : 's'}.`
            : '';
          addToast({
            title: 'Log saved',
            message: `Daily log added for ${workDate}.${shared}`,
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
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
              Work date
            </label>
            <input
              type="date"
              value={workDate}
              max={todayKey}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-bold tabular-nums"
              required
            />
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] flex items-end pb-2">
            Logged at submit: {formatDisplayDateTime(new Date())}
          </div>
        </div>

        <Input
          label="What did you work on?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task name or summary"
          icon={Target}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
              Time In
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-bold tabular-nums"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
              Time Out
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-bold tabular-nums"
              required
            />
          </div>
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

        <MemberSelect
          label="Include teammates"
          value={memberIds}
          onChange={setMemberIds}
          excludeUserId={user?._id}
          placeholder="Same work — no duplicate entry for them"
        />
        <p className="text-[9px] text-[var(--color-text-muted)] -mt-3 flex items-center gap-1">
          <Users size={10} /> Each selected member gets this log on their daily history.
        </p>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-medium outline-none min-h-[100px] focus:ring-1 focus:ring-blue-500/30 transition-all resize-none"
            placeholder="Any extra details..."
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createLogMutation.isPending || !title.trim() || !startTime || !endTime}
        >
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
