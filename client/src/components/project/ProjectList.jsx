import React from 'react';
import { Badge, ProgressBar, NexusDropdown } from '../ui';
import { MoreVertical, User, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';

const ProjectList = ({ tasks, onUpdate, onDetail }) => {
  const statuses = ['todo', 'in-progress', 'in-review', 'done'];

  return (
    <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] w-10"></th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Priority</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Assignee</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Due Date</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-bg-border)]">
            {tasks.map(task => (
              <tr key={task._id} className={`hover:bg-[var(--color-bg-workspace)] transition-colors group ${task.status === 'done' ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => onUpdate(task._id, { status: task.status === 'done' ? 'todo' : 'done', progress: task.status === 'done' ? 0 : 100 })}
                    className={`transition-colors ${task.status === 'done' ? 'text-emerald-500' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
                  >
                    {task.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="cursor-pointer" onClick={() => onDetail(task)}>
                    <p className={`text-sm font-bold text-[var(--color-text-primary)] transition-all ${task.status === 'done' ? 'line-through decoration-2 decoration-emerald-500/50 text-[var(--color-text-muted)]' : ''}`}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-xs uppercase font-black tracking-widest">
                      {task.status === 'done' && task.completedAt ? `Completed ${format(new Date(task.completedAt), 'MMM d')}` : task.description}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    {statuses.map(s => (
                      <button
                        key={s}
                        onClick={() => onUpdate(task._id, { status: s, progress: s === 'done' ? 100 : (s === 'todo' ? 0 : 50) })}
                        className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                          task.status === s 
                            ? s === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' :
                              s === 'in-review' ? 'bg-purple-500 border-purple-500 text-white' :
                              s === 'in-progress' ? 'bg-blue-500 border-blue-500 text-white' :
                              'bg-slate-500 border-slate-500 text-white'
                            : 'bg-transparent border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)]'
                        }`}
                      >
                        {s.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={task.priority === 'high' || task.priority === 'critical' ? 'critical' : 'todo'}>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-bg-border)] flex items-center justify-center overflow-hidden border border-[var(--color-bg-border)] shadow-sm">
                      {task.assignees?.[0]?.avatar ? (
                        <img src={task.assignees[0].avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={12} className="text-[var(--color-text-muted)]" />
                      )}
                    </div>
                    <span className="text-[10px] font-black text-[var(--color-text-secondary)] uppercase truncate max-w-[80px]">
                      {task.assignees?.[0]?.name || 'UNASSIGNED'}
                    </span>
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
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onDetail(task)}
                    className="p-2 hover:bg-[var(--color-bg-border)] rounded-xl text-[var(--color-text-muted)] transition-all"
                  >
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-20 text-center text-[var(--color-text-muted)] italic">
                  No tasks found in this project.
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
