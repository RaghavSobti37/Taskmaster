import React from 'react';
import { Users } from 'lucide-react';
import { Card, ProgressBar } from '../ui';
import { useLogs } from '../../hooks/useTaskmasterQueries';
import { taskAssignedToUserId } from '../../utils/normalizeTask';
import { isSameDay } from 'date-fns';

const SquadCard = ({ teamMembers = [], tasks = [], loading = false }) => {
  const { data: logs = [], isLoading: logsLoading } = useLogs('all');
  const isLoading = loading || logsLoading;

  if (isLoading) {
    return (
      <Card className="p-5 space-y-5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-[var(--color-bg-border)] rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 w-2/3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-border)] animate-pulse shrink-0" />
                  <div className="space-y-2 w-full">
                    <div className="h-3 bg-[var(--color-bg-border)] rounded animate-pulse w-3/4" />
                    <div className="h-2 bg-[var(--color-bg-border)] rounded animate-pulse w-1/3" />
                  </div>
                </div>
                <div className="h-3 w-8 bg-[var(--color-bg-border)] rounded animate-pulse" />
              </div>
              <div className="h-1 w-full bg-[var(--color-bg-border)] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const todayLogs = logs.filter(l => l.createdAt && isSameDay(new Date(l.createdAt), new Date()));
  const activeUserIds = new Set(todayLogs.map(l => typeof l.userId === 'object' ? l.userId?._id?.toString() : l.userId?.toString()));

  const sortedMembers = [...teamMembers].sort((a, b) => {
    const aActive = activeUserIds.has(a._id?.toString());
    const bActive = activeUserIds.has(b._id?.toString());
    if (aActive === bActive) return a.name?.localeCompare(b.name);
    return aActive ? -1 : 1;
  });

  return (
    <Card className="p-5 space-y-5 shadow-md">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
          <Users size={16} className="text-blue-500" /> My Squad
        </h4>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
          {activeUserIds.size} Active Today
        </span>
      </div>
      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
        {sortedMembers.map(member => {
          const memberTasks = tasks.filter((t) => taskAssignedToUserId(t, member._id));
          const completedCount = memberTasks.filter(t => t.status === 'done').length;
          const progress = memberTasks.length 
            ? Math.round((completedCount / memberTasks.length) * 100) 
            : 0;

          const isActiveToday = activeUserIds.has(member._id?.toString());

          return (
            <div key={member._id} className="space-y-2 p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center font-bold text-xs text-[var(--color-text-primary)] shrink-0">
                    {member.avatar ? (
                      <img src={member.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      member.name?.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                      {member.name}
                      {isActiveToday ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Active Today" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500/50 shrink-0" title="Offline" />
                      )}
                    </span>
                    <span className={`text-[9px] font-bold tracking-wider uppercase ${isActiveToday ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'}`}>
                      {isActiveToday ? 'Active Today' : 'Offline'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-muted)] font-mono">
                  {progress}%
                </span>
              </div>
              <ProgressBar progress={progress} />
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default SquadCard;
