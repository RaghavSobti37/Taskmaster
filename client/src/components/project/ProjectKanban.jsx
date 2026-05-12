import React from 'react';
import { Badge, ProgressBar } from '../ui';
import { User, Clock, AlertCircle } from 'lucide-react';

const KanbanCard = ({ task }) => (
  <div className="p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-bg-border)] shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group">
    <div className="flex items-start justify-between mb-3">
      <Badge variant={task.priority === 'high' || task.priority === 'critical' ? 'critical' : 'todo'}>
        {task.priority}
      </Badge>
      <button className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
        <AlertCircle size={14} />
      </button>
    </div>
    <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{task.title}</h4>
    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-4">{task.description}</p>
    
    <div className="flex items-center justify-between pt-4 border-t border-[var(--color-bg-border)]">
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        <Clock size={12} />
        <span className="text-[10px] font-bold">2d left</span>
      </div>
      <div className="w-6 h-6 rounded-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center">
        <User size={12} className="text-[var(--color-text-muted)]" />
      </div>
    </div>
  </div>
);

const ProjectKanban = ({ tasks }) => {
  const columns = [
    { id: 'todo', label: 'Backlog', color: 'bg-gray-500' },
    { id: 'in-progress', label: 'Active Execution', color: 'bg-blue-500' },
    { id: 'in-review', label: 'Management Inspection', color: 'bg-orange-500' },
    { id: 'done', label: 'Finalized', color: 'bg-green-500' },
  ];

  return (
    <div className="flex gap-6 overflow-x-auto pb-4 min-h-[600px]">
      {columns.map(column => {
        const columnTasks = tasks.filter(t => t.status === column.id);
        return (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${column.color}`} />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">{column.label}</h3>
                <span className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-workspace)] px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 bg-[var(--color-bg-workspace)]/50 rounded-2xl border border-[var(--color-bg-border)] p-3 space-y-3">
              {columnTasks.map(task => (
                <KanbanCard key={task._id} task={task} />
              ))}
              {columnTasks.length === 0 && (
                <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-bg-border)] rounded-xl">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">No active units</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectKanban;
