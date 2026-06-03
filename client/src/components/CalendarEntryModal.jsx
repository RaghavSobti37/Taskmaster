import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle2, Calendar as CalIcon, Globe, Lock, Briefcase, Link2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ModalShell, ModalFooter } from './ui/ModalShell';
import NexusDropdown from './ui/NexusDropdown';
import WorkspaceSelect from './forms/WorkspaceSelect';
import ProjectSelect from './forms/ProjectSelect';
import { CALENDAR_EVENT_TYPES } from '../constants/calendarOptions';
import { useProjects } from '../hooks/useTaskmasterQueries';
import { extractEventRange, normalizeMeetingLink } from '../utils/calendarEventTime';
import { getTodayDateKey, validateCalendarEventRange } from '../utils/dateValidation';
import { useSystemToast } from '../lib/systemLogBridge';

const CalendarEntryModal = ({
  isOpen,
  onClose,
  onEntryCreated,
  initialData = null,
  defaultDate = null,
}) => {
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('event');
  const [meetingLink, setMeetingLink] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [workspace, setWorkspace] = useState('General');
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useSystemToast();
  const todayKey = getTodayDateKey();

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      const range = extractEventRange(initialData);
      setStartDate(range.startDate);
      setStartTime(range.startTime);
      setEndDate(range.endDate);
      setEndTime(range.endTime);
      setDescription(initialData.description || '');
      setEventType(initialData.eventType || 'event');
      setMeetingLink(initialData.meetingLink || '');
      setVisibility(initialData.visibility || 'private');
      setWorkspace(initialData.workspace || 'General');
      setProjectId(initialData.projectId?._id || initialData.projectId || '');
    } else {
      setTitle('');
      const base = defaultDate || new Date();
      const baseDate = formatDateInput(base);
      const safeStartDate = baseDate < todayKey ? todayKey : baseDate;
      setStartDate(safeStartDate);
      setStartTime('09:00');
      setEndDate(safeStartDate);
      setEndTime('10:00');
      setDescription('');
      setEventType('event');
      setMeetingLink('');
      setVisibility('public');
      setWorkspace('General');
      setProjectId('');
    }
  }, [initialData, isOpen, defaultDate, todayKey]);

  useEffect(() => {
    if (eventType !== 'meeting') setMeetingLink('');
  }, [eventType]);

  const handleStartDateChange = (value) => {
    const next = value < todayKey ? todayKey : value;
    setStartDate(next);
    if (!endDate || endDate < next) setEndDate(next);
  };

  if (!isOpen) return null;

  const handleWorkspaceChange = (ws) => {
    setWorkspace(ws);
    const inWs = (p) => String(p.workspace || 'General').toUpperCase() === String(ws || 'General').toUpperCase();
    if (projectId && !projects.some((p) => p._id === projectId && inWs(p))) {
      setProjectId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const rangeCheck = validateCalendarEventRange({
      startDate,
      startTime,
      endDate,
      endTime,
    });
    if (!rangeCheck.ok) {
      addToast({ type: 'error', message: rangeCheck.error });
      return;
    }

    if (visibility === 'project' && !projectId) {
      addToast({ type: 'error', message: 'Please select a project for project-related visibility.' });
      return;
    }

    const trimmedLink = meetingLink.trim();
    if (eventType === 'meeting' && trimmedLink && trimmedLink.length < 4) {
      addToast({ type: 'error', message: 'Please enter a valid meeting link.' });
      return;
    }

    setLoading(true);
    const payload = {
      title,
      startDate,
      startTime,
      endDate,
      endTime,
      description,
      eventType,
      meetingLink: eventType === 'meeting' ? normalizeMeetingLink(trimmedLink) : '',
      visibility,
      workspace: visibility === 'project' ? workspace : undefined,
      projectId: visibility === 'project' ? projectId : undefined,
    };

    try {
      if (initialData?._id && initialData.type !== 'task') {
        const res = await axios.put(`/api/calendar/${initialData._id}`, payload);
        if (onEntryCreated) onEntryCreated(res.data, true);
      } else if (!initialData?._id) {
        const res = await axios.post('/api/calendar', payload);
        if (onEntryCreated) onEntryCreated(res.data, false);
      }
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      onClose();
    } catch (err) {
      console.error('Error saving calendar entry:', err);
      addToast({
        type: 'error',
        message: err.response?.data?.error || 'Failed to save calendar event',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="lg" zIndex={100}>
      <header className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)] shrink-0">
        <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <CalIcon size={18} className="text-[var(--color-action-primary)]" />
          {initialData ? 'Edit Event' : 'New Calendar Event'}
        </h3>
        <button type="button" onClick={onClose} className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
          <X size={20} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="tm-modal-scroll p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Event Name</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
              placeholder="e.g. Team meeting"
              required
            />
          </div>

          <div className="space-y-2">
            <NexusDropdown
              label="Event Type"
              options={CALENDAR_EVENT_TYPES}
              value={eventType}
              onChange={setEventType}
              placeholder="Select type..."
            />
          </div>

          {eventType === 'meeting' && (
            <div className="space-y-2 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40 p-4">
              <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                <Link2 size={12} className="shrink-0" />
                Meeting Link (optional)
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/30 outline-none font-bold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                placeholder="https://meet.google.com/..."
              />
              <p className="text-[10px] text-sky-400 font-medium">
                Paste a Google Meet, Zoom, or Teams URL — shown as a Join button on the calendar.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1"></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Start Date</label>
                <input
                  type="date"
                  min={todayKey}
                  value={startDate}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  onKeyDown={(e) => e.preventDefault()}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold cursor-pointer"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold cursor-pointer"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1"> </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">End Date</label>
                <input
                  type="date"
                  min={startDate || todayKey}
                  value={endDate}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  onKeyDown={(e) => e.preventDefault()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold cursor-pointer"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold cursor-pointer"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold min-h-[80px] resize-none"
              placeholder="Add details..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Who can see this?</label>
            <div className="flex flex-wrap gap-2">
              
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-xs border transition-all ${
                  visibility === 'public'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shadow-sm'
                    : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-emerald-500/30'
                }`}
              >
                <Globe size={14} />
                Everyone
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-xs border transition-all ${
                  visibility === 'private'
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 shadow-sm'
                    : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-purple-500/30'
                }`}
              >
                <Lock size={14} />
                Only Me
              </button>
              <button
                type="button"
                onClick={() => setVisibility('project')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-xs border transition-all ${
                  visibility === 'project'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 shadow-sm'
                    : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-blue-500/30'
                }`}
              >
                <Briefcase size={14} />
                Project Related
              </button>
            </div>
          </div>

          {visibility === 'project' && (
            <div className="space-y-4 p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
              <WorkspaceSelect value={workspace} onChange={handleWorkspaceChange} />
              <ProjectSelect
                label="Project"
                projects={projects}
                value={projectId}
                onChange={setProjectId}
                workspaceFilter={workspace}
              />
            </div>
          )}
        </div>

        <ModalFooter className="justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !title}
            className="bg-[var(--color-action-primary)] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {loading ? 'Saving...' : <><CheckCircle2 size={18} /> {initialData ? 'Update Event' : 'Save Event'}</>}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

function formatDateInput(value) {
  if (!value) return new Date().toISOString().split('T')[0];
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

export default CalendarEntryModal;
