import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Plus, ArrowRight } from 'lucide-react';
import { DashboardWidgetShell, DataListRow, Button, DataLoading } from '../ui';
import RelativeTimestamp from '../ui/RelativeTimestamp';
import { useUserNotes } from '../../hooks/useTaskmasterQueries';
import { getAllNoteDrafts, isNoteDraftStale } from '../../utils/noteDraftStorage';

const stripHtml = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const notePreview = (content, max = 80) => {
  const plain = stripHtml(content);
  if (!plain) return '(empty note)';
  return plain.length <= max ? plain : `${plain.slice(0, max).trim()}…`;
};

const NotesPanel = () => {
  const navigate = useNavigate();
  const { data: notes = [], isLoading } = useUserNotes();
  const noteById = new Map(notes.map((note) => [String(note._id), note]));
  const drafts = getAllNoteDrafts().filter((draft) => {
    if (draft.id === 'new') return false;
    return isNoteDraftStale(draft, noteById.get(String(draft.id)));
  });
  const recent = notes.slice(0, 4);

  return (
    <DashboardWidgetShell
      className="shrink-0"
      bodyClassName="p-0 flex flex-col"
      title="Notes"
      icon={StickyNote}
      actions={(
        <button
          type="button"
          onClick={() => navigate('/notes')}
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
        >
          Open
        </button>
      )}
    >
      <div className="p-3 border-b border-[var(--color-bg-border)] flex gap-2">
        <Button size="xs" className="flex-1 gap-1" onClick={() => navigate('/notes')}>
          <Plus size={12} />
          New note
        </Button>
        <Button size="xs" variant="secondary" className="gap-1" onClick={() => navigate('/notes')}>
          <ArrowRight size={12} />
          All notes
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="px-3 py-2 border-b border-amber-500/20 bg-amber-500/5">
          <p className="text-[10px] font-bold text-amber-600">
            {drafts.length} unsaved draft{drafts.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {(isLoading || recent.length > 0) && (
        <div className={recent.length > 3 ? 'max-h-[min(40vh,240px)] overflow-y-auto custom-scrollbar' : ''}>
          {isLoading && <DataLoading className="!py-3" />}
          {recent.map((note) => {
            const projectName = note.projectId?.name || note.calendarEventId?.title || 'Personal';
            return (
              <DataListRow
                key={note._id}
                onClick={() => navigate(`/notes/${note._id}`)}
                primary={(
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-bold text-[var(--color-text-primary)] truncate">
                      {note.title || 'Untitled'}
                    </span>
                    <RelativeTimestamp
                      value={note.updatedAt || note.createdAt}
                      className="text-[9px] font-black uppercase text-[var(--color-text-muted)] shrink-0"
                    />
                  </div>
                )}
                secondary={(
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                    {notePreview(note.content)} · {projectName}
                  </p>
                )}
              />
            );
          })}
        </div>
      )}

      {!isLoading && recent.length === 0 && drafts.length === 0 && (
        <p className="px-4 py-6 text-center text-[11px] text-[var(--color-text-muted)]">
          Full-page editor with rich formatting, drafts, and project links.
        </p>
      )}
    </DashboardWidgetShell>
  );
};

export default NotesPanel;
