import React from 'react';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { StatCard, Skeleton } from '../ui';

const StatCards = ({ metrics = {}, loading = false, onCardClick = () => {}, activeFilter = 'all' }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-3 flex flex-col gap-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] h-[90px] bg-[var(--color-bg-surface)] animate-pulse">
            <div className="h-3 w-1/2 bg-[var(--color-bg-border)] rounded" />
            <div className="h-6 w-1/3 bg-[var(--color-bg-border)] rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${activeFilter === 'all' ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
        <StatCard 
          label="Work Completed" 
          value={`${metrics.completionRate || 0}%`} 
          icon={CheckCircle2} 
          variant="mint" 
          info="The percentage of assigned tasks you have finished." 
          onClick={() => onCardClick('all')}
          className="border-0"
        />
      </div>
      <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${activeFilter === 'urgent' ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
        <StatCard 
          label="Urgent Tasks" 
          value={metrics.criticalTasks || 0} 
          icon={AlertCircle} 
          variant="rose" 
          info="Important work items that need your attention immediately." 
          onClick={() => onCardClick('urgent')}
          className="border-0"
        />
      </div>
      <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${activeFilter === 'overdue' ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
        <StatCard 
          label="Overdue Items" 
          value={metrics.overdueTasks || 0} 
          icon={Clock} 
          variant="apricot" 
          info="Tasks that have passed their planned completion date." 
          onClick={() => onCardClick('overdue')}
          className="border-0"
        />
      </div>
      <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${activeFilter === 'focus' ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
        <StatCard 
          label="Focus Time Today" 
          value={`${metrics.focusHours || 0}h`} 
          icon={TrendingUp} 
          variant="info" 
          info="Total time logged on tasks within the last 24 hours." 
          className="border-0"
        />
      </div>
    </div>
  );
};

export default StatCards;
