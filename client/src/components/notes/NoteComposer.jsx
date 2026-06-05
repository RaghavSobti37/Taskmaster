import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../ui';
import NoteRichEditor from './NoteRichEditor';
import SaveNoteDialog from './SaveNoteDialog';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { useCreateNote } from '../../hooks/useTaskmasterQueries';
import {
  saveNoteDraft,
  clearNoteDraft,
  getNoteDraft,
  hasUnsavedNoteFields,
  normalizeNoteFields,
} from '../../utils/noteDraftStorage';
import { useToast } from '../../contexts/ToastContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

const DRAFT_ID = 'new';

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

const isEmptyContent = (html) => !stripHtml(html);

export default function NoteComposer({ onSaved, className = '' }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const createNote = useCreateNote();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef(null);
  const savedBaselineRef = useRef(normalizeNoteFields('', ''));

  useEffect(() => {
    if (hydrated) return;
    const localDraft = getNoteDraft(DRAFT_ID);
    if (localDraft && hasUnsavedNoteFields(localDraft, savedBaselineRef.current)) {
      setTitle(localDraft.title || '');
      setContent(localDraft.content || '');
    } else if (localDraft) {
      clearNoteDraft(DRAFT_ID);
    }
    setHydrated(true);
  }, [hydrated]);

  const cancelDraftTimer = useCallback(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const persistDraft = useCallback(() => {
    const current = normalizeNoteFields(title, content);
    if (!hasUnsavedNoteFields(current, savedBaselineRef.current)) {
      clearNoteDraft(DRAFT_ID);
      return;
    }
    saveNoteDraft(DRAFT_ID, { title, content, format: 'html' });
  }, [title, content]);

  useEffect(() => {
    if (!hydrated) return undefined;
    cancelDraftTimer();
    saveTimer.current = window.setTimeout(persistDraft, 800);
    return cancelDraftTimer;
  }, [title, content, hydrated, persistDraft, cancelDraftTimer]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const onLeave = () => persistDraft();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      persistDraft();
    };
  }, [hydrated, persistDraft]);

  useEffect(() => {
    const onSaveShortcut = () => {
      if (title.trim() || !isEmptyContent(content)) setSaveOpen(true);
    };
    window.addEventListener('coreknot:note-save', onSaveShortcut);
    return () => window.removeEventListener('coreknot:note-save', onSaveShortcut);
  }, [title, content]);

  const noteDraft = useMemo(() => normalizeNoteFields(title, content), [title, content]);
  const editBaseline = useMemo(() => normalizeNoteFields('', ''), []);
  const hasNoteChanges = hasUnsavedNoteFields(noteDraft, editBaseline);

  const resetComposer = useCallback(() => {
    cancelDraftTimer();
    setTitle('');
    setContent('');
    savedBaselineRef.current = normalizeNoteFields('', '');
    clearNoteDraft(DRAFT_ID);
  }, [cancelDraftTimer]);

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
    hasChanges: hasNoteChanges && hydrated,
    onSave: handleSaveFromBar,
    onCancel: resetComposer,
    isSaving: createNote.isPending,
    enabled: hydrated,
    elevated: true,
    fieldLabels: { title: 'Title', content: 'Content' },
  });

  const handleSave = async (saveMeta) => {
    const payload = {
      title: title.trim() || 'Untitled',
      content,
      format: 'html',
      ...saveMeta,
    };

    try {
      const created = await createNote.mutateAsync(payload);
      cancelDraftTimer();
      clearNoteDraft(DRAFT_ID);
      savedBaselineRef.current = normalizeNoteFields('', '');
      setTitle('');
      setContent('');
      toast.success('Note saved');
      setSaveOpen(false);
      onSaved?.(created);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
  };

  const saving = createNote.isPending;
  const canSave = title.trim() || !isEmptyContent(content);

  return (
    <section
      className={`rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] overflow-hidden ${className}`}
      aria-label="Write a note"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="mobile-form-control flex-1 min-w-0 text-base font-bold bg-transparent border-0 outline-none placeholder:text-[var(--color-text-muted)]"
        />
        <Button
          size="sm"
          onClick={() => setSaveOpen(true)}
          disabled={saving || !canSave}
          className="gap-1 shrink-0"
        >
          <Save size={14} />
          <span className="hidden sm:inline">Save</span>
        </Button>
      </div>

      <div className="px-2 sm:px-4 py-3 min-h-[220px] lg:min-h-[280px] note-editor-page-body">
        <NoteRichEditor
          value={content}
          onChange={setContent}
          isMobile={isMobile}
          placeholder="Write your note… Use the toolbar for formatting."
        />
      </div>

      <SaveNoteDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onConfirm={handleSave}
        saving={saving}
        initialMeta={{}}
      />
    </section>
  );
}
