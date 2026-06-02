import React, { useState } from 'react';
import { format } from 'date-fns';
import { StickyNote, Save, Trash2 } from 'lucide-react';
import { DashboardWidgetShell, DataListRow, Button } from '../ui';
import WorkspaceProjectFields, { filterProjectsByWorkspace } from '../forms/WorkspaceProjectFields';
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
  const [workspace, setWorkspace] = useState('General');

  const resetComposer = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setProjectId('');
    setWorkspace('General');
  };

  const loadNote = (note) => {
    const pid = note.projectId?._id || note.projectId || '';
    const project = projects.find((p) => p._id === pid);
    setEditingId(note._id);
    setTitle(note.title || '');
    setContent(note.content || '');
    setProjectId(pid);
    setWorkspace(project?.workspace || 'General');
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
    <DashboardWidgetShell
      className="shrink-0"
      bodyClassName="p-0 flex flex-col"
      title="Private Notes"
      icon={StickyNote}
    >
      <div className="p-3 border-b border-[var(--color-bg-border)] space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full text-xs font-bold bg-transparent border-b border-[var(--color-bg-border)] py-1 outline-none"
        />
        <WorkspaceProjectFields
          projects={projects}
          workspace={workspace}
          projectId={projectId}
          onChange={({ workspace: ws, projectId: pid }) => {
            setWorkspace(ws);
            setProjectId(pid);
          }}
          layout="inline"
          allowEmptyProject
          emptyProjectLabel="Select project"
          workspaceLabel=""
          projectLabel=""
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full text-[11px] min-h-[72px] bg-transparent border-0 border-b border-[var(--color-bg-border)] py-2 outline-none resize-y placeholder:text-[var(--color-text-muted)]"
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
        className={`-mx-0 ${notes.length > 4 ? 'max-h-[min(40vh,280px)] overflow-y-auto custom-scrollbar' : ''}`}
      >
        {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] px-4 py-2">Loading...</p>}
        {notes.map((note) => {
          const projectName = note.projectId?.name || 'Personal';
          const dateLabel = format(new Date(note.updatedAt || note.createdAt), 'MMM d, yyyy');
          return (
            <DataListRow
              key={note._id}
              onClick={() => loadNote(note)}
              accentColor={editingId === note._id ? 'var(--color-action-primary)' : undefined}
              className={editingId === note._id ? 'bg-[var(--color-bg-secondary)]' : ''}
              primary={
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)]">{dateLabel}</span>
                  <span className="text-[9px] font-bold text-[var(--color-action-primary)] truncate">{projectName}</span>
                </div>
              }
              secondary={
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{notePreview(note.content)}</p>
              }
            />
          );
        })}
      </div>
      )}

      {editingId && (
        <div className="px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={() => deleteNote.mutate(editingId, { onSuccess: resetComposer })}
            className="text-[10px] text-red-500 flex items-center gap-1 font-bold"
          >
            <Trash2 size={12} /> Delete note
          </button>
        </div>
      )}
    </DashboardWidgetShell>
  );
};

export default NotesPanel;
