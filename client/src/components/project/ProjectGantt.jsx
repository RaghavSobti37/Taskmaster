import React from 'react';
import { format } from 'date-fns';

const ProjectGantt = ({ tasks }) => {
  return (
    <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] overflow-hidden">
      <div className="flex border-b border-[var(--color-bg-border)]">
        <div className="w-64 flex-shrink-0 p-4 border-r border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Operational Unit</h3>
        </div>
        <div className="flex-1 p-4 bg-[var(--color-bg-workspace)] overflow-hidden">
          <div className="flex justify-between">
            {['May 1', 'May 8', 'May 15', 'May 22', 'May 29'].map(date => (
              <span key={date} className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{date}</span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-[var(--color-bg-border)]">
        {tasks.map((task, i) => (
          <div key={task._id} className="flex hover:bg-[var(--color-bg-workspace)]/50 transition-colors">
            <div className="w-64 flex-shrink-0 p-4 border-r border-[var(--color-bg-border)] flex flex-col justify-center">
              <span className="text-sm font-bold truncate">{task.title}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-tight">Phase 1: Architecture</span>
            </div>
            <div className="flex-1 p-4 relative h-16">
              {/* Timeline Grid lines */}
              <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
                {[1, 2, 3, 4, 5].map(j => <div key={j} className="w-px h-full bg-[var(--color-bg-border)]" />)}
              </div>
              
              {/* Task Bar */}
              <div 
                className={`absolute h-8 top-4 rounded-lg flex items-center px-3 shadow-sm border border-white/20`}
                style={{ 
                  left: `${(i * 15) + 5}%`, 
                  width: `${20 + (i * 10)}%`,
                  backgroundColor: task.status === 'done' ? 'var(--color-status-done)' : 'var(--color-action-primary)'
                }}
              >
                <span className="text-[10px] font-bold text-white truncate">{task.progress}%</span>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="p-20 text-center text-[var(--color-text-muted)] italic">
            Chronology Gantt: No active sequence paths mapped.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectGantt;
