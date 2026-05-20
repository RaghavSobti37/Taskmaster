import React from 'react';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { StatCard, Skeleton } from '../ui';

const StatCards = ({ metrics = {}, loading = false }) => {
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
      <StatCard 
        label="Work Completed" 
        value={`${metrics.completionRate || 0}%`} 
        icon={CheckCircle2} 
        variant="mint" 
        info="The percentage of assigned tasks you have finished." 
      />
      <StatCard 
        label="Urgent Tasks" 
        value={metrics.criticalTasks || 0} 
        icon={AlertCircle} 
        variant="rose" 
        info="Important work items that need your attention immediately." 
      />
      <StatCard 
        label="Overdue Items" 
        value={metrics.overdueTasks || 0} 
        icon={Clock} 
        variant="apricot" 
        info="Tasks that have passed their planned completion date." 
      />
      <StatCard 
        label="Focus Time Today" 
        value={`${metrics.focusHours || 0}h`} 
        icon={TrendingUp} 
        variant="info" 
        info="Total time logged on tasks within the last 24 hours." 
      />
    </div>
  );
};

export default StatCards;
