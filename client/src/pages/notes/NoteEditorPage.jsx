import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button, LoadingState } from '../../components/ui';
import NoteRichEditor from '../../components/notes/NoteRichEditor';
import SaveNoteDialog from '../../components/notes/SaveNoteDialog';
import { useIsMobile } from '../../hooks/useBreakpoint';
import {
  useNote,
  useUpdateNote,
  useDeleteNote,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import {
  saveNoteDraft,
  clearNoteDraft,
  getNoteDraft,
  hasUnsavedNoteFields,
  normalizeNoteFields,
  purgeMatchingNoteDraft,
} from '../../utils/noteDraftStorage';
import { useToast } from '../../contexts/ToastContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

const isEmptyContent = (html) => !stripHtml(html);

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export default function NoteEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const draftId = id;
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const toast = useToast();
  const { user } = useAuth();

  const { data: note, isLoading } = useNote(id, !isNew);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [meta, setMeta] = useState({});
  const [editBaseline, setEditBaseline] = useState(() => normalizeNoteFields('', ''));
  const saveTimer = useRef(null);
  const savedBaselineRef = useRef(normalizeNoteFields('', ''));

  const isOwner = isNew || String(note?.userId?._id || note?.userId) === String(user?._id);
  const readOnly = !isNew && !isOwner;

  const cancelDraftTimer = useCallback(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (hydrated) return;
    if (!isNew && isLoading) return;

    const localDraft = getNoteDraft(draftId);
    if (!isNew && note) {
      const serverTime = new Date(note.updatedAt || 0).getTime();
      const draftNewer = localDraft?.updatedAt && localDraft.updatedAt > serverTime;
      const baseline = normalizeNoteFields(note.title, note.content);
      savedBaselineRef.current = baseline;
      setEditBaseline(baseline);

      if (draftNewer && hasUnsavedNoteFields(localDraft, baseline)) {
        setTitle(localDraft.title || note.title || '');
        setContent(localDraft.content || note.content || '');
        toast.success('Restored unsaved draft from this device');
      } else {
        setTitle(note.title || '');
        setContent(note.content || '');
        purgeMatchingNoteDraft(draftId, note);
      }
      setMeta({
        workspace: note.workspace,
        projectId: note.projectId,
        calendarEventId: note.calendarEventId,
        visibility: note.visibility,
        shareWithTeam: note.shareWithTeam,
      });
    } else if (localDraft) {
      setTitle(localDraft.title || '');
      setContent(localDraft.content || '');
    }

    setHydrated(true);
  }, [isNew, isLoading, note, draftId, hydrated, toast]);

  const persistDraft = useCallback(() => {
    if (readOnly) return;
    const current = normalizeNoteFields(title, content);
    if (!hasUnsavedNoteFields(current, savedBaselineRef.current)) {
      clearNoteDraft(draftId);
      return;
    }
    saveNoteDraft(draftId, { title, content, format: 'html' });
  }, [draftId, title, content, readOnly]);

  useEffect(() => {
    if (!hydrated || readOnly) return undefined;
    cancelDraftTimer();
    saveTimer.current = window.setTimeout(persistDraft, 800);
    return cancelDraftTimer;
  }, [title, content, hydrated, persistDraft, readOnly, cancelDraftTimer]);

  useEffect(() => {
    if (!hydrated || readOnly) return undefined;
    const onLeave = () => persistDraft();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      persistDraft();
    };
  }, [hydrated, persistDraft, readOnly]);

  useEffect(() => {
    const onSaveShortcut = () => {
      if (!readOnly && (title.trim() || !isEmptyContent(content))) setSaveOpen(true);
    };
    window.addEventListener('coreknot:note-save', onSaveShortcut);
    return () => window.removeEventListener('coreknot:note-save', onSaveShortcut);
  }, [title, content, readOnly]);

  useEffect(() => {
    if (isNew) navigate('/notes', { replace: true });
  }, [isNew, navigate]);

  const noteDraft = useMemo(() => normalizeNoteFields(title, content), [title, content]);
  const hasNoteChanges = hasUnsavedNoteFields(noteDraft, editBaseline);

  const handleRevertNoteEdits = useCallback(() => {
    setTitle(editBaseline.title || '');
    setContent(editBaseline.content || '');
    clearNoteDraft(id);
  }, [editBaseline, id]);

  const handleSaveFromBar = useCallback(() => {
    if (title.trim() || !isEmptyContent(content)) setSaveOpen(true);
  }, [title, content]);

  useUnsavedChanges({
    baseline: editBaseline,
    draft: noteDraft,
    setDraft: (snap) => {
      setTitle(snap.title || '');
      setContent(snap.content || '');
    },
    hasChanges: hasNoteChanges && !readOnly,
    onSave: handleSaveFromBar,
    onCancel: handleRevertNoteEdits,
    isSaving: updateNote.isPending,
    enabled: hydrated && !readOnly,
    elevated: true,
    fieldLabels: { title: 'Title', content: 'Content' },
    excludeFields: ['content'],
  });

  const handleSave = async (saveMeta) => {
    const payload = {
      title: title.trim() || 'Untitled',
      content,
      format: 'html',
      ...saveMeta,
    };

    try {
      await updateNote.mutateAsync({ id, data: payload });
      cancelDraftTimer();
      clearNoteDraft(id);
      const nextBaseline = normalizeNoteFields(payload.title, payload.content);
      savedBaselineRef.current = nextBaseline;
      setEditBaseline(nextBaseline);
      setMeta(saveMeta);
      toast.success('Note updated');
      setSaveOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm('Delete this note permanently?')) return;
    try {
      await deleteNote.mutateAsync(id);
      clearNoteDraft(id);
      toast.success('Note deleted');
      navigate('/notes');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const saving = updateNote.isPending;

  if (isNew) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100vh-8rem)] -mx-4 lg:mx-0">
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10">
        <button
          type="button"
          onClick={() => navigate('/notes')}
          className="p-2 -ml-2 rounded-lg hover:bg-[var(--color-bg-secondary)] min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back to notes"
        >
          <ArrowLeft size={20} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          readOnly={readOnly}
          placeholder="Note title"
          className="mobile-form-control flex-1 min-w-0 text-lg font-bold bg-transparent border-0 outline-none placeholder:text-[var(--color-text-muted)]"
        />
        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setSaveOpen(true)}
              disabled={saving || (!title.trim() && isEmptyContent(content))}
              className="gap-1"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}
          {isOwner && !isNew && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Delete note"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </header>

      {readOnly && (
        <p className="shrink-0 px-4 py-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
          Shared note — read only
        </p>
      )}

      <div className="flex-1 min-h-0 px-2 sm:px-4 py-3 note-editor-page-body">
        <NoteRichEditor
          value={content}
          onChange={setContent}
          isMobile={isMobile}
          readOnly={readOnly}
          placeholder="Write your note… Use the toolbar for formatting."
        />
      </div>

      <SaveNoteDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onConfirm={handleSave}
        saving={saving}
        initialMeta={meta}
      />
    </div>
  );
}
