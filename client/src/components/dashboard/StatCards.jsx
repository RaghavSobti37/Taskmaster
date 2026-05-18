import React from 'react';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { StatCard } from '../ui';

const StatCards = ({ metrics = {} }) => {
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
