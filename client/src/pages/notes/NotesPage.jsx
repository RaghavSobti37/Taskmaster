import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Clock, Lock, Users } from 'lucide-react';
import { PageContainer, PageHeader, DataListRow, PageSkeleton, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import RelativeTimestamp from '../../components/ui/RelativeTimestamp';
import NoteComposer from '../../components/notes/NoteComposer';
import { useUserNotes } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { getAllNoteDrafts, isNoteDraftStale } from '../../utils/noteDraftStorage';

const stripHtml = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const preview = (content, max = 100) => {
  const plain = stripHtml(content);
  if (!plain) return '(empty)';
  return plain.length <= max ? plain : `${plain.slice(0, max)}…`;
};

const visibilityLabel = (note) => {
  if (note.visibility === 'private' || !note.shareWithTeam) {
    return { icon: Lock, text: 'Private' };
  }
  return { icon: Users, text: 'Shared' };
};

export default function NotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: notes = [], isLoading, isError, error, refetch } = useUserNotes();

  const noteById = useMemo(
    () => new Map(notes.map((note) => [String(note._id), note])),
    [notes]
  );

  const drafts = getAllNoteDrafts().filter((draft) => {
    if (draft.id === 'new') return false;
    return isNoteDraftStale(draft, noteById.get(String(draft.id)));
  });

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [notes]
  );

  return (
    <PageContainer>
      <PageHeader
        title="Notes"
        subtitle="Write up top — saved notes below"
      />

      <NoteComposer className="mb-8" />

      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load notes')}
          onRetry={() => refetch()}
        />
      )}

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="tm-section-label mb-2 flex items-center gap-2">
            <Clock size={12} />
            Unsaved drafts
          </h2>
          <div className="rounded-[var(--radius-atomic)] border border-amber-500/30 bg-amber-500/5 overflow-hidden">
            {drafts.map((draft) => (
              <DataListRow
                key={draft.id}
                onClick={() => navigate(`/notes/${draft.id}`)}
                primary={(
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                      {draft.title?.trim() || 'Untitled draft'}
                    </span>
                    <span className="text-[10px] font-bold text-amber-600 shrink-0 uppercase tracking-wide">
                      Resume
                    </span>
                  </div>
                )}
                secondary={(
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{preview(draft.content)}</p>
                )}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="tm-section-label mb-2">Saved notes</h2>
        {isLoading ? (
          <PageSkeleton />
        ) : sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-[var(--radius-atomic)] border border-dashed border-[var(--color-bg-border)]">
            <StickyNote size={32} className="text-[var(--color-text-muted)] mb-3" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">No saved notes yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">
              Use the editor above — your work is saved when you click Save.
            </p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] overflow-hidden">
            {sortedNotes.map((note) => {
              const isOwner = String(note.userId?._id || note.userId) === String(user?._id);
              const vis = visibilityLabel(note);
              const VisIcon = vis.icon;
              const projectName = note.projectId?.name;
              const eventTitle = note.calendarEventId?.title;
              const contextLabel = eventTitle || projectName || 'Personal';
              return (
                <DataListRow
                  key={note._id}
                  onClick={() => navigate(`/notes/${note._id}`)}
                  primary={(
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                        {note.title || 'Untitled'}
                      </span>
                      <RelativeTimestamp
                        value={note.updatedAt || note.createdAt}
                        className="text-[10px] text-[var(--color-text-muted)] shrink-0"
                      />
                    </div>
                  )}
                  secondary={(
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{preview(note.content)}</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                        <span className="text-[var(--color-action-primary)] truncate">{contextLabel}</span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <VisIcon size={10} />
                          {vis.text}
                        </span>
                        {!isOwner && <span>· Shared with you</span>}
                      </div>
                    </div>
                  )}
                />
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
