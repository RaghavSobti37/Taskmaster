import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Trash2, AlertTriangle, Settings, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ModalShell, ModalFooter } from './ui/ModalShell';
import { Button } from './ui/primitives';
import { useUnsavedChanges, stableJsonEqual } from '../hooks/useUnsavedChanges';

const ProjectSettingsModal = ({ isOpen, onClose, project, onProjectUpdated }) => {
  const [name, setName] = useState(project?.name || '');
  const [desc, setDesc] = useState(project?.description || '');
  const [starred, setStarred] = useState(project?.starred || false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDesc(project.description || '');
      setStarred(project.starred || false);
    }
  }, [project]);

  const hasChanges =
    !!project &&
    !stableJsonEqual(
      { name, description: desc, starred },
      { name: project.name || '', description: project.description || '', starred: project.starred || false }
    );

  const revertEdits = () => {
    if (!project) return;
    setName(project.name || '');
    setDesc(project.description || '');
    setStarred(project.starred || false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    try {
      const res = await axios.put(`/api/projects/${project._id}`, { name, description: desc, starred });
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

  const { revert: revertProjectEdits } = useUnsavedChanges({
    hasChanges: isOpen && hasChanges && !showDeleteConfirm,
    onSave: () => handleSubmit(),
    onCancel: revertEdits,
    isSaving: loading,
    enabled: false,
  });

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
    <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100}>
      <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)] shrink-0">
        <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Settings size={18} className="text-[var(--color-action-primary)]" />
          Project Settings
        </h3>
        <button type="button" onClick={onClose} aria-label="Close project settings" className="inline-flex items-center justify-center min-h-11 min-w-11 p-2 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors touch-manipulation">
          <X size={20} />
        </button>
      </header>

      {showDeleteConfirm ? (
        <div className="p-8 text-center space-y-6 overflow-y-auto flex-1 min-h-0">
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
            <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-6 py-3 bg-[var(--color-bg-workspace)] rounded-xl font-bold text-sm">Cancel</button>
            <button type="button" onClick={handleDelete} className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-500/20">Delete Project</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="tm-modal-scroll p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[80px] text-sm" />
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)]">
            <div className="flex items-center gap-2.5">
              <Star size={16} className={starred ? 'text-amber-400 fill-amber-400' : 'text-[var(--color-text-muted)]'} />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">Star Project</p>
                <p className="text-[9px] text-[var(--color-text-muted)] font-medium">Starred projects appear at the top of your list</p>
              </div>
            </div>
            <button type="button" onClick={() => setStarred((s) => !s)} className={`relative w-10 h-5 rounded-full transition-all duration-300 ${starred ? 'bg-amber-400' : 'bg-[var(--color-bg-border)]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${starred ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          </div>

          <ModalFooter className="justify-between">
            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-red-500 font-bold text-xs hover:underline">
              <Trash2 size={14} /> Delete Project
            </button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertProjectEdits}
                disabled={!hasChanges || loading}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => handleSubmit()}
                disabled={!hasChanges || loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </ModalFooter>
        </form>
      )}
    </ModalShell>
  );
};

export default ProjectSettingsModal;
