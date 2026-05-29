import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ListTodo, FolderPlus, StickyNote, Calendar, Link2, Bug } from 'lucide-react';
import { NexusModal, Button, Input } from './ui';
import TaskCreateModal from './TaskCreateModal';
import CalendarEntryModal from './CalendarEntryModal';
import { useCreateNote } from '../hooks/useTaskmasterQueries';
import axios from 'axios';

const QuickAddMenu = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const createNote = useCreateNote();

  const actions = [
    { id: 'task', label: 'Task', icon: ListTodo, onClick: () => { setOpen(false); setTaskOpen(true); } },
    { id: 'project', label: 'Project', icon: FolderPlus, onClick: () => { setOpen(false); navigate('/projects/new'); } },
    { id: 'note', label: 'Note', icon: StickyNote, onClick: () => { setOpen(false); setNoteOpen(true); } },
    { id: 'event', label: 'Event', icon: Calendar, onClick: () => { setOpen(false); setEventOpen(true); } },
    { id: 'asset', label: 'Asset', icon: Link2, onClick: () => { setOpen(false); navigate('/assets?add=1'); } },
    { id: 'bug', label: 'Report Bug', icon: Bug, onClick: () => { setOpen(false); setBugOpen(true); } },
  ];

  const submitNote = () => {
    createNote.mutate({ title: noteTitle || 'Untitled', content: noteContent }, {
      onSuccess: () => { setNoteOpen(false); setNoteTitle(''); setNoteContent(''); }
    });
  };

  const submitBug = async () => {
    if (!bugTitle.trim() || !bugDesc.trim()) return;
    await axios.post('/api/tasks/bug', {
      page: window.location.pathname,
      title: bugTitle.trim(),
      description: bugDesc.trim(),
      severity: 'medium'
    });
    setBugOpen(false);
    setBugTitle('');
    setBugDesc('');
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex flex-col gap-1.5 mb-1 p-2 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] shadow-xl"
            >
              {actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={a.onClick}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:bg-[var(--color-bg-secondary)] whitespace-nowrap"
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
          <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className="w-full min-h-[100px] p-3 rounded-xl border border-[var(--color-bg-border)] text-sm" placeholder="Note content..." />
          <Button onClick={submitNote} disabled={createNote.isPending}>Save Note</Button>
        </div>
      </NexusModal>

      <NexusModal isOpen={bugOpen} onClose={() => setBugOpen(false)} title="Report Bug" showFooter={false}>
        <div className="space-y-3 pt-2">
          <Input value={bugTitle} onChange={(e) => setBugTitle(e.target.value)} placeholder="Issue title" />
          <textarea value={bugDesc} onChange={(e) => setBugDesc(e.target.value)} className="w-full min-h-[100px] p-3 rounded-xl border border-[var(--color-bg-border)] text-sm" placeholder="Steps to reproduce..." />
          <Button onClick={submitBug}>Submit</Button>
        </div>
      </NexusModal>
    </>
  );
};

export default QuickAddMenu;
