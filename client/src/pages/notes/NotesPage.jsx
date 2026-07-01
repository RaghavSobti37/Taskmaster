import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Clock } from 'lucide-react';
import {
  ListPageLayout,
  DataListRow,
  PageSkeleton,
  QueryErrorBanner,
  getQueryErrorMessage,
  EmptyState,
  SearchInput,
  PageHeader,
  StatusBadge,
} from '../../components/ui';
import { countActiveFilters } from '../../components/ui/selectionFilterUtils';
import RelativeTimestamp from '../../components/ui/RelativeTimestamp';
import NoteComposer from '../../components/notes/NoteComposer';
import { useUserNotes } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { getAllNoteDrafts, isNoteDraftStale } from '../../utils/noteDraftStorage';
import { useDebounce } from '../../hooks/useDebounce';

const stripHtml = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const preview = (content, max = 100) => {
  const plain = stripHtml(content);
  if (!plain) return '(empty)';
  return plain.length <= max ? plain : `${plain.slice(0, max)}…`;
};

const visibilityLabel = (note) => {
  if (note.visibility === 'private' || !note.shareWithTeam) {
    return 'Private';
  }
  return 'Shared';
};

const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All notes' },
  { value: 'private', label: 'Private only' },
  { value: 'shared', label: 'Shared only' },
];

function noteMatchesVisibility(note, visibilityFilter) {
  if (visibilityFilter === 'all') return true;
  const isPrivate = note.visibility === 'private' || !note.shareWithTeam;
  return visibilityFilter === 'private' ? isPrivate : !isPrivate;
}

function noteMatchesSearch(note, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const title = (note.title || '').toLowerCase();
  const body = stripHtml(note.content).toLowerCase();
  const project = (note.projectId?.name || '').toLowerCase();
  const event = (note.calendarEventId?.title || '').toLowerCase();
  return title.includes(q) || body.includes(q) || project.includes(q) || event.includes(q);
}

export default function NotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: notes = [], isLoading, isError, error, refetch } = useUserNotes();
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 200);

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

  const filteredNotes = useMemo(
    () => sortedNotes.filter(
      (note) => noteMatchesSearch(note, debouncedSearch.trim())
        && noteMatchesVisibility(note, visibilityFilter)
    ),
    [sortedNotes, debouncedSearch, visibilityFilter]
  );

  const handleClearNoteFilters = useCallback(() => {
    setVisibilityFilter('all');
  }, []);

  const notesFilterFields = useMemo(() => [
    {
      id: 'visibility',
      label: 'Visibility',
      type: 'radio',
      value: visibilityFilter,
      defaultValue: 'all',
      options: VISIBILITY_OPTIONS,
      onChange: setVisibilityFilter,
    },
  ], [visibilityFilter]);

  return (
    <ListPageLayout
      containerClassName="!py-4"
      toolbarFill
      header={(
        <PageHeader
          icon={StickyNote}
          title="Notes"
          description="Capture ideas, link to projects or events, and share with your team when ready."
        />
      )}
      filterFields={notesFilterFields}
      filterSheetTitle="Note filters"
      mobileFilterCount={countActiveFilters(notesFilterFields)}
      onActiveFiltersClear={handleClearNoteFilters}
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search title, body, project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-full"
        />
      )}
    >
      <NoteComposer className="mb-8" compact />

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
        ) : filteredNotes.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title={notes.length === 0 ? 'No saved notes yet' : 'No notes match filters'}
            description={
              notes.length === 0
                ? 'Use the editor above — your work is saved when you click Save.'
                : 'Try clearing search or visibility filter.'
            }
            variant="dashed"
          />
        ) : (
          <div className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] overflow-hidden">
            {filteredNotes.map((note) => {
              const isOwner = String(note.userId?._id || note.userId) === String(user?._id);
              const vis = visibilityLabel(note);
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge role="neutral" className="!text-[9px] uppercase tracking-wider truncate max-w-[45%]">
                          {contextLabel}
                        </StatusBadge>
                        <StatusBadge role="neutral" className="!text-[9px] uppercase tracking-wider shrink-0">
                          {vis}
                        </StatusBadge>
                        {!isOwner && (
                          <StatusBadge role="neutral" className="!text-[9px] uppercase tracking-wider shrink-0">
                            Shared with you
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  )}
                />
              );
            })}
          </div>
        )}
      </section>
    </ListPageLayout>
  );
}
