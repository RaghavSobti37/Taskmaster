import React, { useState } from 'react';
import { Briefcase, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, DataTable, Badge } from '../ui';
import { formatDueDate } from '../../utils/formatDueDate';
import { getPriorityBadgeVariant } from '../../constants/taskOptions';

const TaskTable = ({
  tasks = [],
  projects = [],
  workspaces = [],
  completingIds = new Set(),
  onCompleteTask,
  onSelectTask,
  filter,
  setFilter,
  loading = false
}) => {
  const [sortConfig, setSortConfig] = useState({ field: null, order: 'asc' }); // 'asc', 'desc'

  const workspaceColorMap = React.useMemo(() => {
    const map = {};
    workspaces.forEach((w) => {
      map[(w.name || '').toUpperCase()] = w.color;
    });
    return map;
  }, [workspaces]);

  const getWorkspaceColor = (project) => {
    if (!project) return '#64748b';
    const key = (project.workspace || 'General').toUpperCase();
    return workspaceColorMap[key] || '#64748b';
  };

  const toggleSort = (field) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        if (prev.order === 'asc') return { field, order: 'desc' };
        if (prev.order === 'desc') return { field: null, order: 'asc' };
      }
      return { field, order: 'asc' };
    });
  };

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
        const workspaceColor = getWorkspaceColor(project);
        const workspaceLabel = project ? (project.workspace || 'General').toUpperCase() : 'UNASSIGNED';

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
            <div className="flex flex-col gap-0.5 pl-2.5 py-0.5" style={{ borderLeft: `3px solid ${workspaceColor}` }}>
              <span className="font-bold text-sm text-[var(--color-text-primary)] leading-snug tracking-tight">
                {row.title}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                {projectName?.toUpperCase()} · {workspaceLabel}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      header: (
        <button 
          onClick={() => toggleSort('priority')}
          className="flex items-center gap-1 hover:text-[var(--color-action-primary)] transition-colors"
        >
          Priority
          {sortConfig.field === 'priority' && (
            sortConfig.order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
          )}
        </button>
      ),
      render: (row) => (
        <Badge variant={getPriorityBadgeVariant(row.priority)}>
          {row.priority}
        </Badge>
      )
    },
    {
      header: 'Created By',
      render: (row) => {
        const creator = row.createdBy?.name || 'Unknown';
        return <span className="text-xs text-[var(--color-text-muted)] font-semibold">{creator}</span>;
      }
    },
    {
      header: (
        <button 
          onClick={() => toggleSort('dueDate')}
          className="flex items-center gap-1 hover:text-[var(--color-action-primary)] transition-colors"
        >
          Due Date
          {sortConfig.field === 'dueDate' && (
            sortConfig.order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
          )}
        </button>
      ),
      render: (row) => {
        if (!row.dueDate) return <span className="text-xs text-slate-500">-</span>;
        const d = new Date(row.dueDate);
        const today = new Date();
        const isOverdue = d.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0);
        const label = formatDueDate(row.dueDate);
        const isTodayLabel = label === 'Today';
        return (
          <span className={`text-xs font-bold ${isOverdue ? 'text-red-500' : isTodayLabel ? 'text-amber-500' : 'text-slate-400'}`}>
            {label}
          </span>
        );
      }
    }
  ];

  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

  const filteredTasks = tasks.filter(t => {
    // For urgent filter, show all statuses - urgent tasks should always be visible
    if (filter === 'urgent') return t.priority === 'critical';
    
    // For other filters, exclude done tasks
    if (t.status === 'done') return false;
    if (filter === 'overdue') return t.dueDate && new Date(t.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
    return true; // 'all'
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Custom sort by sortConfig if set
    if (sortConfig.field === 'priority') {
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      return sortConfig.order === 'asc' ? aPriority - bPriority : bPriority - aPriority;
    }

    if (sortConfig.field === 'dueDate') {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return sortConfig.order === 'asc' ? aDate - bDate : bDate - aDate;
    }

    // Default sort: by date status then priority
    const getSortValue = (t) => {
      if (!t.dueDate) return 4;
      const d = new Date(t.dueDate).setHours(0, 0, 0, 0);
      const today = new Date().setHours(0, 0, 0, 0);
      if (d < today) return 0; // Overdue
      if (d === today) return 1; // Today
      return 2; // Future
    };

    const aTime = getSortValue(a);
    const bTime = getSortValue(b);

    if (aTime !== bTime) return aTime - bTime;

    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });



  return (
    <Card className="flex flex-col shadow-sm border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="p-0">
        <DataTable
          columns={taskColumns}
          data={sortedTasks}
          onRowClick={(task) => onSelectTask(task)}
        />
      </div>
    </Card>
  );
};

export default TaskTable;
