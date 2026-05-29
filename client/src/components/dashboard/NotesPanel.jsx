import React, { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Save, Trash2 } from 'lucide-react';
import { Card, Button } from '../ui';
import ProjectSelect from '../forms/ProjectSelect';
import {
  useUserNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useProjects,
} from '../../hooks/useTaskmasterQueries';

const notePreview = (content, max = 80) => {
  const plain = (content || '').replace(/\s+/g, ' ').trim();
  if (!plain) return '(empty note)';
  return plain.length <= max ? plain : `${plain.slice(0, max).trim()}…`;
};

const NotesPanel = () => {
  const { data: notes = [], isLoading } = useUserNotes();
  const { data: projects = [] } = useProjects();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');

  const resetComposer = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setProjectId('');
  };

  const loadNote = (note) => {
    setEditingId(note._id);
    setTitle(note.title || '');
    setContent(note.content || '');
    setProjectId(note.projectId?._id || note.projectId || '');
  };

  const handleSave = () => {
    const payload = {
      title: title.trim() || 'Untitled',
      content,
      projectId: projectId || null,
    };
    if (editingId) {
      updateNote.mutate({ id: editingId, data: payload }, { onSuccess: resetComposer });
    } else {
      createNote.mutate(payload, { onSuccess: resetComposer });
    }
  };

  const saving = createNote.isPending || updateNote.isPending;

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden shrink-0">
      <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <StickyNote size={14} className="text-amber-500" /> Private Notes
        </h4>
      </div>

      <div className="p-3 border-b border-[var(--color-bg-border)] space-y-2 bg-[var(--color-bg-workspace)]/40">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full text-xs font-bold bg-transparent border-b border-[var(--color-bg-border)] py-1 outline-none"
        />
        <ProjectSelect
          projects={projects}
          value={projectId}
          onChange={setProjectId}
          label=""
          placeholder="Select project"
          allowEmpty
          emptyLabel="Select project"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full text-[11px] min-h-[72px] bg-[var(--color-bg-workspace)] rounded-lg p-2 border border-[var(--color-bg-border)] outline-none resize-y"
          placeholder="Write a note..."
        />
        <div className="flex items-center gap-2">
          <Button size="xs" onClick={handleSave} disabled={saving || !content.trim()}>
            <Save size={12} className="mr-1" /> {editingId ? 'Update' : 'Save'}
          </Button>
          {editingId && (
            <Button size="xs" variant="ghost" onClick={resetComposer}>Cancel</Button>
          )}
        </div>
      </div>

      {(isLoading || notes.length > 0) && (
      <div
        className={`p-2 space-y-1 ${
          notes.length > 4 ? 'max-h-[min(40vh,280px)] overflow-y-auto custom-scrollbar' : ''
        }`}
      >
        {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] px-2 py-1">Loading...</p>}
        {notes.map((note) => {
          const projectName = note.projectId?.name || 'Personal';
          const dateLabel = format(new Date(note.updatedAt || note.createdAt), 'MMM d, yyyy');
          return (
            <button
              key={note._id}
              type="button"
              onClick={() => loadNote(note)}
              className={`w-full text-left px-3 py-2 rounded-xl border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)] transition-colors ${editingId === note._id ? 'ring-1 ring-[var(--color-action-primary)]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)]">{dateLabel}</span>
                <span className="text-[9px] font-bold text-[var(--color-action-primary)] truncate">{projectName}</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{notePreview(note.content)}</p>
            </button>
          );
        })}
      </div>
      )}

      {editingId && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => deleteNote.mutate(editingId, { onSuccess: resetComposer })}
            className="text-[10px] text-red-500 flex items-center gap-1 font-bold"
          >
            <Trash2 size={12} /> Delete note
          </button>
        </div>
      )}
    </Card>
  );
};

export default NotesPanel;
