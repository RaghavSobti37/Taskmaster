import React from 'react';
import { Badge, ProgressBar } from '../ui';
import { MoreVertical, User, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const ProjectList = ({ tasks, onUpdate, onDetail }) => {
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
              <tr key={task._id} className={`hover:bg-[var(--color-bg-workspace)] transition-colors group ${task.status === 'done' ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="cursor-pointer" onClick={() => onDetail(task)}>
                    {task.status === 'done' ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--color-text-primary)] line-through decoration-2 decoration-green-500/50">{task.title}</p>
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                            Finalized {task.completedAt ? format(new Date(task.completedAt), 'MMM d, yyyy') : 'Recently'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-[var(--color-text-primary)] hover:text-[var(--color-action-primary)] transition-colors">{task.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate max-w-xs">{task.description}</p>
                      </>
                    )}
                  </div>
                </td>
                {task.status === 'done' ? (
                  <td colSpan="5" className="px-6 py-4">
                    <div className="flex items-center gap-2 text-green-600 font-black text-[10px] uppercase tracking-[0.2em] bg-green-500/5 w-fit px-4 py-1.5 rounded-xl border border-green-500/10">
                      <CheckCircle2 size={14} /> Completed
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-6 py-4">
                      <select 
                        value={task.status}
                        onChange={(e) => onUpdate(task._id, { status: e.target.value })}
                        className={`text-[10px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg border border-[var(--color-bg-border)] outline-none bg-[var(--color-bg-workspace)] cursor-pointer ${
                          task.status === 'in-progress' ? 'text-blue-500 border-blue-500/20' : 
                          'text-[var(--color-text-muted)]'
                        }`}
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select 
                          value={task.progress}
                          onChange={(e) => onUpdate(task._id, { progress: parseInt(e.target.value) })}
                          className="bg-[var(--color-bg-workspace)] text-[10px] font-black border border-[var(--color-bg-border)] rounded-md px-1.5 py-1 outline-none appearance-none hover:border-[var(--color-action-primary)] transition-all"
                        >
                          {[0, 10, 25, 50, 75, 90, 100].map(p => (
                            <option key={p} value={p}>{p}%</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => onUpdate(task._id, { status: 'done', progress: 100 })}
                          className="p-1.5 rounded-lg hover:bg-green-500/10 text-[var(--color-text-muted)] hover:text-green-600 transition-all"
                          title="Quick Complete"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onDetail(task)}
                    className="px-4 py-1.5 rounded-lg border border-[var(--color-bg-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-action-primary)] hover:text-white hover:border-[var(--color-action-primary)] transition-all"
                  >
                    Edit
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
