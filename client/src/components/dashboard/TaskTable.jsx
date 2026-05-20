import React from 'react';
import { Briefcase, CheckCircle2 } from 'lucide-react';
import { Card, DataTable, Badge } from '../ui';

const TaskTable = ({ 
  tasks = [], 
  projects = [], 
  completingIds = new Set(), 
  onCompleteTask, 
  onSelectTask, 
  filter, 
  setFilter,
  loading = false
}) => {

  if (loading) {
    return (
      <Card className="flex flex-col shadow-md overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
          <div className="h-4 w-32 bg-[var(--color-bg-border)] rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-bg-border)]/50 last:border-0">
              <div className="flex items-center gap-3 w-2/3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-bg-border)] animate-pulse" />
                <div className="space-y-2 w-full">
                  <div className="h-3.5 bg-[var(--color-bg-border)] rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-[var(--color-bg-border)] rounded animate-pulse w-1/4" />
                </div>
              </div>
              <div className="h-5 w-16 bg-[var(--color-bg-border)] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const taskColumns = [
    {
      header: 'Task Detail',
      render: (row) => {
        const isCompleting = completingIds.has(row._id);
        const project = projects.find(p => p._id === row.projectId);
        const projectName = project ? project.name : 'Unassigned';

        return (
          <div className="flex items-center gap-3 py-1">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onCompleteTask(row); 
              }}
              disabled={isCompleting}
              className="w-5 h-5 rounded-full border-2 border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)] flex items-center justify-center transition-all group shrink-0"
              title="Complete Task"
            >
              {isCompleting ? (
                <div className="w-2 h-2 rounded-full bg-[var(--color-action-primary)] animate-pulse" />
              ) : (
                <CheckCircle2 size={14} className="opacity-0 group-hover:opacity-100 text-[var(--color-action-primary)] transition-opacity" />
              )}
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm text-[var(--color-text-primary)] leading-snug tracking-tight">
                {row.title}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-semibold">
                {projectName}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Priority',
      render: (row) => (
        <Badge variant={row.priority === 'critical' ? 'danger' : row.priority === 'high' ? 'warning' : 'info'}>
          {row.priority}
        </Badge>
      )
    }
  ];

  const filteredTasks = tasks.filter(t => t.status !== 'done');

  return (
    <Card className="flex flex-col shadow-md overflow-hidden">
      <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[var(--color-text-primary)]">
          <Briefcase size={16} className="text-[var(--color-action-primary)]" />
          Active Workflow
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilter('all')} 
            className={`text-xs font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all' 
                ? 'bg-[var(--color-bg-primary)] shadow-sm text-[var(--color-action-primary)] border border-[var(--color-bg-border)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            All Items
          </button>
        </div>
      </div>
      <div className="p-0">
        <DataTable 
          columns={taskColumns} 
          data={filteredTasks} 
          onRowClick={(task) => onSelectTask(task)}
        />
      </div>
    </Card>
  );
};

export default TaskTable;
