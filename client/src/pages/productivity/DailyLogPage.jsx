import { formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useState, useMemo, useEffect } from 'react';
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import {
  CheckCircle2, ChevronLeft,
  ChevronRight, Plus, Send, Timer, Zap,
  Activity, Trophy, RefreshCw, Edit2, Trash2, CheckSquare, NotebookPen, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, NexusDropdown, PageHeader, PageContainer, Button, Input, StatCard, DataLoading, Spinner } from '../../components/ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import DailyLogEntryModal from '../../components/productivity/DailyLogEntryModal';
import DailyLogTimeline from '../../components/productivity/DailyLogTimeline';
import DailyLogActivityCalendar from '../../components/productivity/DailyLogActivityCalendar';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/confirmContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  useLogs, useProjects, useTasks, useUserDirectory, useWorkspaces, useUpdateLog, useDeleteLog, useActivityGrid, useAttendance,
} from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { resolveTaskId } from '../../utils/taskCompletion';
import WorkspaceProjectFields, {
  resolveWorkspaceFromProjectName,
} from '../../components/forms/WorkspaceProjectFields';
import { formatMinuteGap } from '../../utils/timeSpent';
import {
  getLogWorkDateKey,
  readLogTimeSpentMinutes,
  isLogEditable,
  formatLogInterval,
  normalizeWorkDate,
} from '../../utils/dailyLogDetails';

const LOG_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'time-desc', label: 'Most time logged' },
  { value: 'time-asc', label: 'Least time logged' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'project', label: 'Project A–Z' },
];

const DailyLogPage = ({ adminViewUserId, adminViewUserName }) => {
  const { user } = useAuth();
  const { addToast } = useSystemToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') ? new Date(searchParams.get('date')) : new Date());

  useEffect(() => {
    if (searchParams.get('view') === 'lead-audits') {
      navigate('/admin/lead-audits', { replace: true });
    }
  }, [searchParams, navigate]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setIsDrawerOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [editingLogId, setEditingLogId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editWorkspace, setEditWorkspace] = useState('General');
  const [editProjectId, setEditProjectId] = useState('');

  const [logSearch, setLogSearch] = useState('');
  const [logSort, setLogSort] = useState('newest');
  const [logWorkspaceFilter, setLogWorkspaceFilter] = useState('all');
  const [logProjectFilter, setLogProjectFilter] = useState('all');

  const targetUserId = adminViewUserId || user?._id;

  const logDateRange = useMemo(() => ({
    startDate: startOfDay(selectedDate).toISOString(),
    endDate: endOfDay(selectedDate).toISOString(),
  }), [selectedDate]);

  const {
    data: logs = [],
    isLoading: logsLoading,
    isFetching: logsFetching,
    isError: logsError,
    error: logsErr,
    refetch: refetchLogs,
  } = useLogs(targetUserId, { limit: 500, action: 'DAILY_LOG', ...logDateRange }, Boolean(targetUserId));
  const deferLogSecondary = useDeferredQueryEnabled(!logsLoading && Boolean(targetUserId));
  const deferLogTertiary = useDeferredQueryEnabled(!logsLoading && Boolean(targetUserId), { tier: 1 });
  const { data: projects = [] } = useProjects(deferLogSecondary);
  const { data: workspaces = [] } = useWorkspaces(deferLogSecondary);
  const { data: tasks = [] } = useTasks(targetUserId, { includeOldCompleted: true }, deferLogSecondary);
  const { data: userDirectory = [] } = useUserDirectory(deferLogSecondary);
  const {
    data: activityGrid = [],
    isError: activityGridError,
    error: activityGridErr,
    refetch: refetchActivityGrid,
  } = useActivityGrid(deferLogTertiary);

  const loading = logsLoading;
  const logsRefetching = logsFetching && !logsLoading;

  const targetUser = userDirectory.find(u => u._id === targetUserId);
  const targetUserName = adminViewUserName || targetUser?.name || '';

  const updateLogMutation = useUpdateLog();
  const deleteLogMutation = useDeleteLog();

  const cleanLogTitle = (title = '') => title.replace(/^Task Finalized:\s*/i, '').trim();
  const cleanLogMessage = (message = '') => {
    if (/^Successfully completed task within .+\.$/i.test(message.trim())) return '';
    return message;
  };

  const handleStartEdit = (log) => {
    const projectName = log.details?.project || '';
    const matchedProject = projects.find(
      (p) => p.name?.toUpperCase() === String(projectName).toUpperCase()
    );
    setEditingLogId(log._id);
    setEditTitle(cleanLogTitle(log.details?.title || ''));
    setEditMessage(cleanLogMessage(log.details?.message || ''));
    setEditStartTime(log.details?.startTime || '');
    setEditEndTime(log.details?.endTime || '');
    setEditWorkspace(log.details?.workspace || resolveWorkspaceFromProjectName(projects, projectName));
    setEditProjectId(matchedProject?._id || '');
  };

  const handleSaveEdit = async (logId) => {
    const log = logs.find((l) => l._id === logId);
    const projectRecord = projects.find((p) => p._id === editProjectId);
    try {
      await updateLogMutation.mutateAsync({
        id: logId,
        data: {
          details: {
            title: editTitle,
            message: editMessage,
            startTime: editStartTime,
            endTime: editEndTime,
            workDate: log ? getLogWorkDateKey(log) : normalizeWorkDate(selectedDate),
            workspace: editWorkspace || projectRecord?.workspace || 'General',
            project: projectRecord?.name || 'General',
          },
          targetId: editProjectId || null,
          targetType: editProjectId ? 'Project' : 'System',
        }
      });
      setEditingLogId(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update log');
    }
  };

  const handleDeleteLog = async (logId) => {
    const ok = await confirm({
      title: 'Delete log?',
      message: 'Are you sure you want to delete this log?',
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteLogMutation.mutateAsync(logId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete log');
    }
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    const key = normalizeWorkDate(date);
    const next = new URLSearchParams(searchParams);
    if (key === normalizeWorkDate(new Date())) next.delete('date');
    else next.set('date', key);
    setSearchParams(next, { replace: true });
  };

  const handleDateChange = (days) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + days);
    handleSelectDate(nextDate);
  };

  const selectedDateKey = useMemo(() => normalizeWorkDate(selectedDate), [selectedDate]);
  const viewingSelf = !adminViewUserId || adminViewUserId === user?._id;
  const { data: attendanceRows = [] } = useAttendance(
    viewingSelf
      ? { start: selectedDateKey, end: selectedDateKey, mine: 'true' }
      : { start: selectedDateKey, end: selectedDateKey },
    Boolean(targetUserId && deferLogSecondary)
  );
  const attendanceEntry = useMemo(() => {
    const rows = Array.isArray(attendanceRows) ? attendanceRows : [];
    if (viewingSelf) return rows[0] || null;
    return rows.find(
      (row) => String(row.userId?._id || row.userId) === String(targetUserId)
    ) || null;
  }, [attendanceRows, viewingSelf, targetUserId]);
  const isTodayOrPast = selectedDateKey <= normalizeWorkDate(new Date());

  const dailyLogs = useMemo(() => {
    const ownerId = String(targetUserId || '');
    return logs.filter((l) => {
      const logOwnerId = String(l.userId?._id || l.userId || '');
      return l.action === 'DAILY_LOG'
        && logOwnerId === ownerId
        && getLogWorkDateKey(l) === selectedDateKey;
    });
  }, [logs, selectedDateKey, targetUserId]);

  const logWorkspaceOptions = useMemo(() => [
    { value: 'all', label: 'All workspaces' },
    ...workspaces.map((w) => ({ value: w.name, label: w.name })),
  ], [workspaces]);

  const logProjectOptions = useMemo(() => {
    let rows = dailyLogs;
    if (logWorkspaceFilter !== 'all') {
      rows = rows.filter(
        (l) => (l.details?.workspace || resolveWorkspaceFromProjectName(projects, l.details?.project))
          === logWorkspaceFilter
      );
    }
    const names = new Set(
      rows.map((l) => l.details?.project || 'GENERAL').filter(Boolean)
    );
    return [
      { value: 'all', label: 'All projects' },
      ...[...names].sort().map((p) => ({ value: p, label: p })),
    ];
  }, [dailyLogs, logWorkspaceFilter, projects]);

  const displayedLogs = useMemo(() => {
    let rows = [...dailyLogs];
    const term = logSearch.trim().toLowerCase();
    if (term) {
      rows = rows.filter((l) =>
        (l.details?.title || '').toLowerCase().includes(term)
        || (l.details?.message || '').toLowerCase().includes(term)
        || (l.details?.project || '').toLowerCase().includes(term)
      );
    }
    if (logWorkspaceFilter !== 'all') {
      rows = rows.filter(
        (l) => (l.details?.workspace || resolveWorkspaceFromProjectName(projects, l.details?.project))
          === logWorkspaceFilter
      );
    }
    if (logProjectFilter !== 'all') {
      rows = rows.filter((l) => (l.details?.project || 'GENERAL') === logProjectFilter);
    }
    rows.sort((a, b) => {
      switch (logSort) {
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'time-desc':
          return readLogTimeSpentMinutes(b) - readLogTimeSpentMinutes(a);
        case 'time-asc':
          return readLogTimeSpentMinutes(a) - readLogTimeSpentMinutes(b);
        case 'title':
          return (a.details?.title || '').localeCompare(b.details?.title || '');
        case 'project':
          return (a.details?.project || '').localeCompare(b.details?.project || '');
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    return rows;
  }, [dailyLogs, logSearch, logSort, logWorkspaceFilter, logProjectFilter, projects]);

  const dailyTasks = useMemo(() => {
    const seen = new Set();
    const rows = [];

    for (const t of tasks) {
      if (t.status !== 'done') continue;
      const taskDate = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt || t.createdAt);
      if (!isSameDay(taskDate, selectedDate)) continue;
      const id = resolveTaskId(t);
      if (id) seen.add(id);
      rows.push(t);
    }

    for (const log of logs) {
      if (log.action !== 'DAILY_LOG') continue;
      const logType = log.details?.type;
      if (logType !== 'TASK_COMPLETION' && logType !== 'TASK_REVIEW') continue;
      if (!getLogWorkDateKey(log) || getLogWorkDateKey(log) !== selectedDateKey) continue;
      const id = String(log.targetId?._id || log.targetId || log._id);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        _id: id,
        title: log.details?.title || 'Completed task',
        status: 'done',
        completedAt: log.createdAt,
      });
    }

    return rows;
  }, [tasks, logs, selectedDateKey]);

  const totalMinutes = useMemo(
    () => dailyLogs.reduce((acc, log) => acc + readLogTimeSpentMinutes(log), 0),
    [dailyLogs]
  );

  const formatTime = (totalMins) => formatMinuteGap(totalMins);

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title={targetUserName ? `${targetUserName}'s History` : 'My Daily Progress'}
        icon={NotebookPen}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)] p-1 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)]">
              <Button variant="ghost" size="xs" title="Previous day" onClick={() => handleDateChange(-1)}><ChevronLeft size={14} /></Button>
              <div className="flex flex-col items-center px-1 min-w-[7.5rem]">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] tabular-nums leading-none">
                  {formatWeekdayDateLong(selectedDate)}
                </span>
                <input
                  type="date"
                  value={selectedDateKey}
                  max={normalizeWorkDate(new Date())}
                  onChange={(e) => e.target.value && handleSelectDate(new Date(`${e.target.value}T12:00:00`))}
                  className="px-0 py-0.5 bg-transparent text-[10px] font-black uppercase tracking-widest tabular-nums border-0 outline-none w-full text-center"
                />
              </div>
              <Button variant="ghost" size="xs" title="Next day" onClick={() => handleDateChange(1)} disabled={isSameDay(selectedDate, new Date())}><ChevronRight size={14} /></Button>
            </div>
            {!adminViewUserId && isTodayOrPast && (
              <Button size="sm" onClick={() => setIsDrawerOpen(true)}><Plus size={14} /> Log Work</Button>
            )}
          </div>
        }
      />

      {logsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(logsErr, 'Failed to load daily logs')}
          onRetry={() => refetchLogs()}
        />
      )}
      {activityGridError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(activityGridErr, 'Failed to load activity grid')}
          onRetry={() => refetchActivityGrid()}
        />
      )}
      {/* Analytical Ribbon - Plain English */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Time" value={formatTime(totalMinutes)} icon={Timer} variant="mint" info="Total hours logged on this date." />
        <StatCard label="Tasks Done" value={dailyTasks.length} icon={CheckSquare} variant="info" info="Number of work items completed today." />
        <StatCard label="Logs Created" value={dailyLogs.length} icon={RefreshCw} variant="apricot" info="Total entries added to your activity stream." />
        <StatCard label="Goal Progress" value={`${Math.min(100, Math.round((totalMinutes / 480) * 100))}%`} icon={Zap} variant="slate" info="Progress towards your 8-hour daily goal." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <DailyLogTimeline logs={dailyLogs} attendanceEntry={attendanceEntry} />
          <section className="flex flex-col min-h-[400px] border-b border-[var(--color-bg-border)]">
             <div className="p-3 border-b border-[var(--color-bg-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="tm-widget-label flex items-center gap-2">
                    <Activity size={14} className="text-blue-500" /> Work History
                  </h3>
                  <Badge variant="slate">
                    {displayedLogs.length}{displayedLogs.length !== dailyLogs.length ? ` / ${dailyLogs.length}` : ''} LOGS
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Input
                    icon={Search}
                    placeholder="Search logs…"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="!py-1.5 !text-xs sm:col-span-2 lg:col-span-1"
                  />
                  <NexusDropdown
                    variant="compact"
                    options={logWorkspaceOptions}
                    value={logWorkspaceFilter}
                    onChange={(value) => {
                      setLogWorkspaceFilter(value);
                      setLogProjectFilter('all');
                    }}
                    placeholder="Workspace"
                  />
                  <NexusDropdown
                    variant="compact"
                    options={logProjectOptions}
                    value={logProjectFilter}
                    onChange={setLogProjectFilter}
                    placeholder="Project"
                  />
                  <NexusDropdown
                    variant="compact"
                    options={LOG_SORT_OPTIONS}
                    value={logSort}
                    onChange={setLogSort}
                    placeholder="Sort"
                  />
                </div>
             </div>
             
             <div className="p-6 space-y-4 relative min-h-[200px]">
                {logsRefetching && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-workspace)]/75">
                    <Spinner size={100} />
                  </div>
                )}
                {loading ? (
                  <DataLoading showPhrase className="py-16" />
                ) : logsRefetching ? null : dailyLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                     <Activity size={48} className="mb-4" />
                     <p className="text-xs font-black uppercase tracking-widest">No activity recorded for this date</p>
                  </div>
                ) : displayedLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 opacity-40 text-center">
                     <Search size={32} className="mb-3" />
                     <p className="text-xs font-black uppercase tracking-widest">No logs match your filters</p>
                  </div>
                ) : (
                  displayedLogs.map((log, idx) => {
                    const isEditable = isLogEditable(log, { isAdmin: isAdminUser(user) });
                    if (editingLogId === log._id) {
                      return (
                        <div key={log._id} className="p-4 bg-[var(--color-bg-workspace)] border border-blue-500/30 rounded-[var(--radius-atomic)] space-y-4">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <Input label="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} size="sm" />
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase">Time In</label>
                                  <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full px-2 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded text-xs tabular-nums" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase">Time Out</label>
                                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full px-2 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded text-xs tabular-nums" />
                                </div>
                              </div>
                           </div>
                           <WorkspaceProjectFields
                             projects={projects}
                             workspace={editWorkspace}
                             projectId={editProjectId}
                             onChange={({ workspace, projectId }) => {
                               setEditWorkspace(workspace);
                               setEditProjectId(projectId);
                             }}
                             layout="inline"
                             allowEmptyProject
                             emptyProjectLabel="None"
                           />
                           <textarea 
                             value={editMessage} 
                             onChange={e => setEditMessage(e.target.value)}
                             className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-medium outline-none min-h-[80px]"
                           />
                           <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="xs" onClick={() => setEditingLogId(null)}>Cancel</Button>
                              <Button size="xs" onClick={() => handleSaveEdit(log._id)} disabled={updateLogMutation.isPending}>Save</Button>
                           </div>
                        </div>
                      );
                    }
                    return (
                      <motion.div 
                        key={log._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group p-4 border-b border-[var(--color-bg-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]/30 transition-all flex gap-4 relative overflow-hidden"
                      >
                         <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <span className="text-xs font-black uppercase tracking-tight tm-data-primary">{cleanLogTitle(log.details?.title)}</span>
                                  {log.details?.isSharedCopy && (
                                    <Badge variant="warning" className="text-[8px] py-0">via {log.details?.sharedByName || 'teammate'}</Badge>
                                  )}
                                  {(log.details?.sharedMemberIds?.length > 0) && (
                                    <Badge variant="mint" className="text-[8px] py-0">+{log.details.sharedMemberIds.length} shared</Badge>
                                  )}
                                  {(log.details?.type === 'TASK_REVIEW'
                                    || log.details?.title === '[review]') && (
                                    <Badge variant="warning" className="text-[8px] py-0">[review]</Badge>
                                  )}
                                  <Badge variant="slate" className="text-[8px] py-0">{log.details?.workspace || resolveWorkspaceFromProjectName(projects, log.details?.project)}</Badge>
                                  <Badge variant="info" className="text-[8px] py-0">{log.details?.project || 'GENERAL'}</Badge>
                               </div>
                               <div className="flex flex-col items-end gap-1 text-[10px] font-bold text-[var(--color-text-muted)]">
                                  <span className="tabular-nums">
                                    Logged {formatDisplayDateTime(new Date(log.createdAt))}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10 tabular-nums">
                                      {formatLogInterval(log)}
                                    </span>
                                    <span className="text-[9px] tabular-nums opacity-80">
                                      ({formatMinuteGap(readLogTimeSpentMinutes(log))})
                                    </span>
                                  </div>
                                  {isEditable && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                      <Button variant="ghost" size="xs" className="!p-1 text-blue-400 hover:bg-blue-500/10" onClick={() => handleStartEdit(log)}>
                                        <Edit2 size={12} />
                                      </Button>
                                      <Button variant="ghost" size="xs" className="!p-1 text-rose-400 hover:bg-rose-500/10" onClick={() => handleDeleteLog(log._id)}>
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  )}
                               </div>
                            </div>
                            {cleanLogMessage(log.details?.message) && (
                              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{cleanLogMessage(log.details?.message)}</p>
                            )}
                         </div>
                      </motion.div>
                    );
                  })
                )}
             </div>
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-6">
           <DailyLogActivityCalendar
             activityGrid={activityGrid}
             selectedDate={selectedDate}
             onSelectDate={handleSelectDate}
           />

           <section className="p-4 border border-[var(--color-bg-border)]">
              <div className="relative z-10 space-y-4">
                 <div className="flex items-center justify-between">
                    <h4 className="tm-widget-label text-blue-400">Daily Goal</h4>
                    <Trophy size={14} className="text-amber-500" />
                 </div>
                 <div className="space-y-1.5">
                    <div className="flex justify-between items-end">
                       <span className="text-xl font-black italic tabular-nums">{Math.min(100, Math.round((totalMinutes / 480) * 100))}%</span>
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{totalMinutes >= 480 ? 'GOAL MET' : 'IN PROGRESS'}</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${Math.min(100, (totalMinutes / 480) * 100)}%` }}
                         className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                       />
                    </div>
                 </div>
              </div>
           </section>
        </aside>
      </div>

      <DailyLogEntryModal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        defaultWorkDate={selectedDate}
      />
    </PageContainer>
  );
};

export default DailyLogPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
