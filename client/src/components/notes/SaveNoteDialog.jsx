import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Lock, Users, X } from 'lucide-react';
import { Button } from '../ui/primitives';
import WorkspaceProjectFields from '../forms/WorkspaceProjectFields';
import NexusDropdown from '../ui/NexusDropdown';
import { useCalendarEvents, useProjects } from '../../hooks/useTaskmasterQueries';

const LINK_TYPES = [
  { value: 'none', label: 'Personal (no link)' },
  { value: 'project', label: 'Project' },
  { value: 'event', label: 'Calendar event' },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private — only me', icon: Lock },
  { value: 'shared', label: 'Share with team', icon: Users },
];

export default function SaveNoteDialog({
  open,
  onClose,
  onConfirm,
  saving = false,
  initialMeta = {},
}) {
  const { data: projects = [] } = useProjects();
  const { data: calendarEvents = [] } = useCalendarEvents();

  const [linkType, setLinkType] = useState('none');
  const [workspace, setWorkspace] = useState('General');
  const [projectId, setProjectId] = useState('');
  const [calendarEventId, setCalendarEventId] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [shareWithTeam, setShareWithTeam] = useState(false);

  useEffect(() => {
    if (!open) return;
    const meta = initialMeta || {};
    setLinkType(meta.calendarEventId ? 'event' : meta.projectId ? 'project' : 'none');
    setWorkspace(meta.workspace || 'General');
    setProjectId(meta.projectId?._id || meta.projectId || '');
    setCalendarEventId(meta.calendarEventId?._id || meta.calendarEventId || '');
    setVisibility(meta.visibility === 'private' ? 'private' : 'shared');
    setShareWithTeam(Boolean(meta.shareWithTeam));
  }, [open, initialMeta]);

  const eventOptions = useMemo(
    () => calendarEvents
      .filter((ev) => ev._id && !String(ev._id).startsWith('google-'))
      .slice(0, 80)
      .map((ev) => ({
        value: ev._id,
        label: `${ev.title} · ${formatDisplayDateShort(new Date(ev.date || ev.dueDate))}`,
        searchKey: `${ev.title} ${ev.workspace || ''}`,
      })),
    [calendarEvents]
  );

  const selectedEvent = calendarEvents.find((ev) => ev._id === calendarEventId);

  useEffect(() => {
    if (linkType !== 'event' || !selectedEvent) return;
    if (selectedEvent.projectId) {
      setProjectId(selectedEvent.projectId?._id || selectedEvent.projectId || '');
    }
    if (selectedEvent.workspace) setWorkspace(selectedEvent.workspace);
  }, [linkType, selectedEvent]);

  const handleConfirm = () => {
    const isPrivate = visibility === 'private';
    onConfirm({
      workspace: linkType === 'none' ? '' : workspace,
      projectId: linkType === 'project' || (linkType === 'event' && projectId) ? projectId || null : null,
      calendarEventId: linkType === 'event' ? calendarEventId || null : null,
      visibility: isPrivate ? 'private' : linkType === 'event' ? 'event' : linkType === 'project' ? 'project' : 'private',
      shareWithTeam: !isPrivate && shareWithTeam,
    });
  };

  const canShare = linkType !== 'none' && (projectId || calendarEventId);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] bottom-[max(1rem,env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:max-h-[90vh] z-[201] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Save note"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Save note</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
              <div>
                <p className="tm-section-label mb-2">Link to</p>
                <NexusDropdown
                  options={LINK_TYPES}
                  value={linkType}
                  onChange={setLinkType}
                  placeholder="Choose link type"
                />
              </div>

              {linkType === 'project' && (
                <WorkspaceProjectFields
                  projects={projects}
                  workspace={workspace}
                  projectId={projectId}
                  onChange={({ workspace: ws, projectId: pid }) => {
                    setWorkspace(ws);
                    setProjectId(pid);
                  }}
                  allowEmptyProject={false}
                />
              )}

              {linkType === 'event' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                    <CalendarDays size={16} />
                    <span className="text-xs font-semibold">Pick a meeting or event</span>
                  </div>
                  <NexusDropdown
                    options={eventOptions}
                    value={calendarEventId}
                    onChange={setCalendarEventId}
                    placeholder="Select event..."
                    searchable
                  />
                  {selectedEvent?.projectId && (
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Linked project members can be included when sharing.
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="tm-section-label mb-2">Visibility</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = visibility === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVisibility(opt.value)}
                        className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-colors min-h-[52px] ${
                          active
                            ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10'
                            : 'border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]'
                        }`}
                      >
                        <Icon size={16} className="shrink-0 mt-0.5 text-[var(--color-action-primary)]" />
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {visibility === 'shared' && canShare && (
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[var(--color-bg-border)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareWithTeam}
                    onChange={(e) => setShareWithTeam(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Share with project team</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      Members on the linked project can read this note. You can turn this off to keep it private even when linked.
                    </p>
                  </div>
                </label>
              )}

              {visibility === 'shared' && !canShare && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Link to a project or event above to enable team sharing.
                </p>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-[var(--color-bg-border)] shrink-0">
              <Button variant="secondary" className="flex-1 min-h-[48px]" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button className="flex-1 min-h-[48px]" onClick={handleConfirm} disabled={saving}>
                {saving ? 'Saving…' : 'Save note'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
