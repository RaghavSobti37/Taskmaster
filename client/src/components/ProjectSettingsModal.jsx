import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Trash2, AlertTriangle, Settings, Star, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#64748b', // slate
];

const ProjectSettingsModal = ({ isOpen, onClose, project, onProjectUpdated }) => {
  const [name, setName] = useState(project?.name || '');
  const [desc, setDesc] = useState(project?.description || '');
  const [color, setColor] = useState(project?.color || '#3b82f6');
  const [starred, setStarred] = useState(project?.starred || false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDesc(project.description || '');
      setColor(project.color || '#3b82f6');
      setStarred(project.starred || false);
    }
  }, [project]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(`/api/projects/${project._id}`, {
        name,
        description: desc,
        color,
        starred,
      });
      onProjectUpdated(res.data);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
      onClose();
    } catch (err) {
      console.error('Error updating project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/projects/${project._id}`);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-bg-surface)] w-full max-w-lg rounded-3xl border border-[var(--color-bg-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
          <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Settings size={18} className="text-[var(--color-action-primary)]" />
            Project Settings
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </header>

        {showDeleteConfirm ? (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h4 className="text-xl font-bold text-red-600">Delete This Project?</h4>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">
                This will permanently delete this project and all its tasks. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-6 py-3 bg-[var(--color-bg-workspace)] rounded-xl font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
              >
                Delete Project
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[80px] text-sm"
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Palette size={11} /> Project Color
              </label>
              <div className="flex items-center gap-2.5 flex-wrap p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)]">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all duration-200 shadow-md ${
                      color === c
                        ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-workspace)] scale-125 ring-[var(--color-text-primary)]'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <span className="text-[9px] font-black uppercase tracking-widest ml-auto" style={{ color }}>
                  {color}
                </span>
              </div>
            </div>

            {/* Starred Toggle */}
            <div className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)]">
              <div className="flex items-center gap-2.5">
                <Star size={16} className={starred ? 'text-amber-400 fill-amber-400' : 'text-[var(--color-text-muted)]'} />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">Star Project</p>
                  <p className="text-[9px] text-[var(--color-text-muted)] font-medium">Starred projects appear at the top of your list</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStarred(s => !s)}
                className={`relative w-10 h-5 rounded-full transition-all duration-300 ${starred ? 'bg-amber-400' : 'bg-[var(--color-bg-border)]'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${starred ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </div>

            <div className="pt-4 border-t border-[var(--color-bg-border)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-red-500 font-bold text-xs hover:underline"
              >
                <Trash2 size={14} /> Delete Project
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name}
                  className="bg-[var(--color-action-primary)] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {loading ? 'Saving...' : <><CheckCircle2 size={18} /> Save Changes</>}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProjectSettingsModal;
