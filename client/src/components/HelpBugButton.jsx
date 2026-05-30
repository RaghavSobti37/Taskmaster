import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Send, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { NexusModal, Button, Input } from './ui';
import { useSystemToast } from '../lib/systemLogBridge';
import { MODULE } from '../lib/systemLogContract';

const HelpBugButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useSystemToast();

  useEffect(() => {
    if (isOpen) {
      setPage(window.location.pathname + window.location.search);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await axios.post('/api/tasks/bug', {
        page,
        title: title.trim(),
        description: description.trim(),
        severity
      });
      addToast({
        title: 'Bug reported',
        message: 'Task created under Tech Project for Raghav.',
        type: 'success',
        id: 'bug-report-success',
        module: MODULE.PROJECTS,
      });
      setIsOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error('Report bug error:', err);
      addToast({
        title: 'Report failed',
        message: err.response?.data?.error || 'Failed to report bug. Please try again.',
        type: 'error',
        id: 'bug-report-error',
        module: MODULE.PROJECTS,
        technicalError: import.meta.env.DEV ? err.stack : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-amber-500 to-rose-600 text-white rounded-full shadow-2xl shadow-rose-500/40 hover:shadow-rose-500/60 transition-all border border-white/20 group"
        title="Report Bug or Issue"
      >
        <Bug size={22} className="group-hover:rotate-12 transition-transform" />
        <span className="absolute right-14 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border border-[var(--color-bg-border)] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Report Platform Bug
        </span>
      </motion.button>

      <NexusModal
        isOpen={isOpen}
        onClose={() => !submitting && setIsOpen(false)}
        showFooter={false}
        title={
          <div className="flex items-center gap-2.5 text-rose-500 font-black tracking-tight text-base">
            <Bug size={20} /> Report Platform Issue or Bug
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Active Page / Section</label>
            <select
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
            >
              <option value="/">/ (Dashboard)</option>
              <option value="/projects">/projects (Projects Overview)</option>
              <option value="/calendar">/calendar (Calendar View)</option>
              <option value="/leads">/leads (CRM Leads)</option>
              <option value="/followups">/followups (CRM Followups)</option>
              <option value="/todo">/todo (To-Do List)</option>
              <option value="/logs">/logs (Daily Logs)</option>
              <option value="/workflows">/workflows (Workflows Canvas)</option>
              <option value="/assets">/assets (Assets)</option>
              <option value="/features">/features (Features)</option>
              <option value="/settings">/settings (Settings)</option>
              <option value="General / Other">General / Other Issue</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Issue Title / Brief Summary *</label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Navigation bar broken on mobile screens"
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Severity / Priority</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
            >
              <option value="low">Low - Minor glitch or aesthetic issue</option>
              <option value="medium">Medium - Functional bug but workaround exists</option>
              <option value="high">High - Core functionality broken</option>
              <option value="blocker">Blocker - Complete crash / data loss hazard</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Detailed Steps & Expected Behavior *</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1. Clicked on button X&#10;2. Modal opened but closed instantly&#10;Expected: Modal stays open."
              className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-sans text-[var(--color-text-primary)] focus:border-blue-500 outline-none resize-y"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--color-bg-border)]">
            <Button size="sm" variant="ghost" type="button" onClick={() => setIsOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" type="submit" className="bg-rose-600 hover:bg-rose-700 font-bold px-5 py-2.5 shadow-lg shadow-rose-500/20" disabled={submitting || !title.trim() || !description.trim()}>
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <><Send size={14} /> Submit Bug Report</>}
            </Button>
          </div>
        </form>
      </NexusModal>
    </>
  );
};

export default HelpBugButton;
