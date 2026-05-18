import React from 'react';
import { Users } from 'lucide-react';
import { Card, ProgressBar } from '../ui';

const SquadCard = ({ teamMembers = [], tasks = [] }) => {
  return (
    <Card className="p-5 space-y-5 shadow-md">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
        <Users size={16} className="text-blue-500" /> My Squad
      </h4>
      <div className="space-y-4">
        {teamMembers.slice(0, 4).map(member => {
          const memberTasks = tasks.filter(t => t.assignees?.includes(member._id));
          const completedCount = memberTasks.filter(t => t.status === 'done').length;
          const progress = memberTasks.length 
            ? Math.round((completedCount / memberTasks.length) * 100) 
            : 0;

          return (
            <div key={member._id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center font-bold text-xs text-[var(--color-text-primary)]">
                    {member.avatar ? (
                      <img src={member.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      member.name?.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {member.name}
                  </span>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-muted)]">
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
