import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ListTodo, FolderPlus, StickyNote, Calendar, Link2, Bug, LayoutGrid, Pin } from 'lucide-react';
import { NexusModal, Button, Input } from './ui';
import TaskCreateModal from './TaskCreateModal';
import CalendarEntryModal from './CalendarEntryModal';
import { useCreateNote, useCreatePin } from '../hooks/useTaskmasterQueries';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';
import axios from 'axios';

const BUG_SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low - Minor glitch or aesthetic issue' },
  { value: 'medium', label: 'Medium - Functional bug but workaround exists' },
  { value: 'high', label: 'High - Core functionality broken' },
  { value: 'critical', label: 'Critical - Complete crash / data loss hazard' },
];

const QuickAddMenu = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
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

  const actions = [
    { id: 'task', label: 'Task', icon: ListTodo, onClick: () => { setOpen(false); setTaskOpen(true); } },
    { id: 'project', label: 'Project', icon: FolderPlus, onClick: () => { setOpen(false); navigate('/projects/new'); } },
    { id: 'workspace', label: 'Workspace', icon: LayoutGrid, onClick: () => { setOpen(false); navigate('/projects', { state: { openCreateWorkspace: true } }); } },
    { id: 'note', label: 'Note', icon: StickyNote, onClick: () => { setOpen(false); setNoteOpen(true); } },
    { id: 'pin', label: 'Pin', icon: Pin, onClick: () => { setOpen(false); setPinOpen(true); } },
    { id: 'event', label: 'Event', icon: Calendar, onClick: () => { setOpen(false); setEventOpen(true); } },
    { id: 'asset', label: 'Asset', icon: Link2, onClick: () => { setOpen(false); navigate('/assets?add=1'); } },
    { id: 'bug', label: 'Report Bug', icon: Bug, onClick: () => { setOpen(false); setBugOpen(true); } },
  ];

  const submitNote = () => {
    createNote.mutate({ title: noteTitle || 'Untitled', content: noteContent }, {
      onSuccess: () => { setNoteOpen(false); setNoteTitle(''); setNoteContent(''); }
    });
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
        ? new Date(response.data.dueDate).toLocaleString()
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

  return (
    <>
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="tm-floating flex flex-col gap-1.5 mb-1 p-2 rounded-[var(--radius-atomic)] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] shadow-xl"
            >
              {actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={a.onClick}
                  className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-atomic)] text-xs font-bold hover:bg-[var(--color-bg-secondary)] whitespace-nowrap"
                >
                  <a.icon size={14} /> {a.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-12 h-12 bg-[var(--color-action-primary)] text-white rounded-full shadow-2xl shadow-teal-500/30 border border-white/20"
          title="Add"
        >
          <Plus size={22} className={open ? 'rotate-45 transition-transform' : ''} />
        </motion.button>
      </div>

      <TaskCreateModal isOpen={taskOpen} onClose={() => setTaskOpen(false)} />
      <CalendarEntryModal isOpen={eventOpen} onClose={() => setEventOpen(false)} />

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
            <Button type="submit" disabled={!bugTitle.trim() || bugSubmitting}>
              {bugSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </NexusModal>
    </>
  );
};

export default QuickAddMenu;
