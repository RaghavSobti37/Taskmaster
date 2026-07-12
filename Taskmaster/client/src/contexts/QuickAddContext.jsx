import { formatDisplayDateTime } from '../utils/dateDisplay';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QuickAddContext } from './quickAddContextCore';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ListTodo, StickyNote, Calendar, Link2, Bug, Pin, NotebookPen } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { NexusModal } from '../components/ui/modals';
import TaskCreateModal from '../components/TaskCreateModal';
import CalendarEntryModal from '../components/CalendarEntryModal';
import DailyLogEntryModal from '../components/productivity/DailyLogEntryModal';
import { useCreateNote, useCreatePin } from '../hooks/useTaskmasterQueries';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';
import axios from 'axios';
import { setShortcutQuickActionHandler } from '../lib/shortcutActionBridge';

const BUG_SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low - Minor glitch or aesthetic issue' },
  { value: 'medium', label: 'Medium - Functional bug but workaround exists' },
  { value: 'high', label: 'High - Core functionality broken' },
  { value: 'critical', label: 'Critical - Complete crash / data loss hazard' },
];

export function QuickAddProvider({ children }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [pinTitle, setPinTitle] = useState('');
  const [pinContent, setPinContent] = useState('');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugSeverity, setBugSeverity] = useState('medium');
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const createNote = useCreateNote();
  const createPin = useCreatePin();
  const queryClient = useQueryClient();
  const { addToast } = useSystemToast();

  const closeMenu = () => setOpen(false);
  const toggleMenu = () => setOpen((value) => !value);

  const actions = useMemo(
    () => [
      { id: 'task', label: 'Task', icon: ListTodo, onClick: () => { closeMenu(); setTaskOpen(true); } },
      { id: 'note', label: 'Note', icon: StickyNote, onClick: () => { closeMenu(); setNoteOpen(true); } },
      { id: 'pin', label: 'Pin', icon: Pin, onClick: () => { closeMenu(); setPinOpen(true); } },
      { id: 'event', label: 'Event', icon: Calendar, onClick: () => { closeMenu(); setEventOpen(true); } },
      { id: 'log', label: 'Daily Log', icon: NotebookPen, onClick: () => { closeMenu(); setLogOpen(true); } },
      { id: 'asset', label: 'Asset', icon: Link2, onClick: () => { closeMenu(); navigate('/assets?add=1'); } },
      { id: 'bug', label: 'Report Bug', icon: Bug, onClick: () => { closeMenu(); setBugOpen(true); } },
    ],
    [navigate]
  );

  const submitNote = () => {
    createNote.mutate(
      { title: noteTitle || 'Untitled', content: noteContent },
      {
        onSuccess: () => {
          setNoteOpen(false);
          setNoteTitle('');
          setNoteContent('');
        },
      }
    );
  };

  const submitPin = () => {
    if (!pinContent.trim()) return;
    createPin.mutate(
      { title: pinTitle.trim(), content: pinContent.trim() },
      {
        onSuccess: () => {
          setPinOpen(false);
          setPinTitle('');
          setPinContent('');
        },
      }
    );
  };

  const resetBugForm = () => {
    setBugTitle('');
    setBugDesc('');
    setBugSeverity('medium');
  };

  const submitBug = async (e) => {
    e?.preventDefault?.();
    if (!bugTitle.trim() || bugSubmitting) return;

    setBugSubmitting(true);
    try {
      const response = await axios.post('/api/tasks/bug', {
        page: window.location.pathname,
        title: bugTitle.trim(),
        description: bugDesc.trim(),
        severity: bugSeverity,
      });

      const dueDate = response.data?.dueDate
        ? formatDisplayDateTime(response.data.dueDate)
        : 'No specific date';

      addToast({
        title: 'Bug reported successfully!',
        message: `Severity: ${bugSeverity.toUpperCase()} | Due: ${dueDate}`,
        type: 'success',
        id: 'bug-report-success',
        module: MODULE.PROJECTS,
      });

      setBugOpen(false);
      resetBugForm();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    } catch (err) {
      addToast({
        title: 'Report failed',
        message: err.response?.data?.error || 'Failed to report bug. Please try again.',
        type: 'error',
        id: 'bug-report-error',
        module: MODULE.PROJECTS,
        technicalError: import.meta.env.DEV ? err.stack : undefined,
      });
    } finally {
      setBugSubmitting(false);
    }
  };

  const runQuickAction = useCallback((id) => {
    const action = actions.find((a) => a.id === id);
    if (action) action.onClick();
  }, [actions]);

  useEffect(() => {
    setShortcutQuickActionHandler(runQuickAction);
    return () => setShortcutQuickActionHandler(null);
  }, [runQuickAction]);

  const value = useMemo(
    () => ({ open, toggleMenu, closeMenu, actions, runQuickAction }),
    [open, actions, runQuickAction]
  );

  return (
    <QuickAddContext.Provider value={value}>
      {children}

      <TaskCreateModal isOpen={taskOpen} onClose={() => setTaskOpen(false)} />
      <CalendarEntryModal isOpen={eventOpen} onClose={() => setEventOpen(false)} />
      <DailyLogEntryModal isOpen={logOpen} onClose={() => setLogOpen(false)} />

      <NexusModal isOpen={noteOpen} onClose={() => setNoteOpen(false)} title="New Note" showFooter={false}>
        <div className="space-y-3 pt-2">
          <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title" />
          <Input multiline rows={4} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Note content..." />
          <Button onClick={submitNote} disabled={createNote.isPending}>Save Note</Button>
        </div>
      </NexusModal>

      <NexusModal isOpen={pinOpen} onClose={() => setPinOpen(false)} title="New Pin" showFooter={false}>
        <div className="space-y-3 pt-2">
          <p className="text-xs text-[var(--color-text-muted)]">Shared on the team pinboard — visible to everyone.</p>
          <Input value={pinTitle} onChange={(e) => setPinTitle(e.target.value)} placeholder="Title (optional)" />
          <Input
            multiline
            rows={4}
            value={pinContent}
            onChange={(e) => setPinContent(e.target.value)}
            placeholder="Pin something for the team..."
          />
          <Button onClick={submitPin} disabled={createPin.isPending || !pinContent.trim()}>
            {createPin.isPending ? 'Pinning...' : 'Save Pin'}
          </Button>
        </div>
      </NexusModal>

      <NexusModal
        isOpen={bugOpen}
        onClose={() => {
          if (!bugSubmitting) {
            setBugOpen(false);
            resetBugForm();
          }
        }}
        title="Report Bug"
        showFooter={false}
      >
        <form onSubmit={submitBug} className="space-y-3 pt-2">
          <Input
            value={bugTitle}
            onChange={(e) => setBugTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Issue title *"
            required
          />
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">
              Severity / Priority
            </label>
            <select
              value={bugSeverity}
              onChange={(e) => setBugSeverity(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
            >
              {BUG_SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={bugDesc}
            onChange={(e) => setBugDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="w-full min-h-[100px] p-3 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/30"
            placeholder="Steps to reproduce (optional). Ctrl+Enter to submit."
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!bugTitle.trim()}
              loading={bugSubmitting}
              loadingLabel="Submitting..."
            >
              Submit
            </Button>
          </div>
        </form>
      </NexusModal>
    </QuickAddContext.Provider>
  );
}

