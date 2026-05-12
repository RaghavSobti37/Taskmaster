import React from 'react';
import { Badge, ProgressBar } from '../ui';
import { MoreVertical, User, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const ProjectList = ({ tasks, onUpdate }) => {
  const statuses = ['todo', 'in-progress', 'in-review', 'done'];

  return (
    <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Task Identifier</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Priority</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Assignee</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Timeline</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] w-32">Progress</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-bg-border)]">
            {tasks.map(task => (
              <tr key={task._id} className="hover:bg-[var(--color-bg-workspace)] transition-colors group">
                <td className="px-6 py-4">
                  <div className="cursor-pointer" onClick={() => onDetail(task)}>
                    <p className="text-sm font-bold text-[var(--color-text-primary)] hover:text-[var(--color-action-primary)] transition-colors">{task.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate max-w-xs">{task.description}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={task.status}
                    onChange={(e) => onUpdate(task._id, { status: e.target.value })}
                    className="bg-transparent border-none outline-none cursor-pointer focus:ring-0 p-0"
                  >
                    {statuses.map(s => (
                      <option key={s} value={s}>{s.toUpperCase()}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={task.priority === 'high' || task.priority === 'critical' ? 'critical' : 'todo'}>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-bg-border)] flex items-center justify-center">
                      <User size={12} className="text-[var(--color-text-muted)]" />
                    </div>
                    <span className="text-xs font-medium">Assignee</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Calendar size={14} />
                    <span className="text-xs font-medium">
                      {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : 'No date'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{task.progress}%</span>
                      {task.status !== 'done' && (
                        <button 
                          onClick={() => onUpdate(task._id, { status: 'done', progress: 100 })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-green-600"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                    </div>
                    <ProgressBar progress={task.progress} />
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1 hover:bg-[var(--color-bg-border)] rounded-md transition-all text-[var(--color-text-muted)]" onClick={() => alert('Task editing coming soon')}>
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-20 text-center text-[var(--color-text-muted)] italic">
                  No execution rows found in this workspace.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectList;
