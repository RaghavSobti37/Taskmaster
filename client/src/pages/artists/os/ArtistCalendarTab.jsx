import { formatDisplayDate } from '../../../utils/dateDisplay';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Badge, Button, Input } from '../../../components/ui';
import { NexusModal } from '../../../components/ui/modals';
import { Plus } from 'lucide-react';
import { CALENDAR_EVENT_COLORS } from './artistOsConstants';
import { formatInr } from './artistOsConstants';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { useArtistOsCalendar, useCreateArtistCalendarEvent } from '../../../hooks/queries/artistOs';

const EMPTY = { title: '', startAt: '', eventType: 'personal' };

function formatDate(d) {
  if (!d) return '—';
  return formatDisplayDate(new Date(d));
}

export default function ArtistCalendarTab({ artistId, isPreview }) {
  const { data: events = [], isLoading, isError, error, refetch } = useArtistOsCalendar(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistCalendarEvent();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.startAt) {
      toast.error('Title and date required');
      return;
    }
    await createMutation.mutateAsync({
      artistId,
      data: {
        title: form.title,
        startAt: form.startAt,
        eventType: form.eventType,
      },
    });
    setOpen(false);
    setForm(EMPTY);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CALENDAR_EVENT_COLORS).map(([key, cfg]) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
              {cfg.label}
            </span>
          ))}
        </div>
        {!isPreview && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Add Event
          </Button>
        )}
      </div>

      {!events.length ? (
        <Card className="p-8 text-center text-xs text-[var(--color-text-muted)]">No calendar events yet.</Card>
      ) : (
        <Card className="p-0 overflow-hidden rounded-2xl divide-y divide-[var(--color-bg-border)]">
          {events.map((ev) => {
            const color = CALENDAR_EVENT_COLORS[ev.type] || CALENDAR_EVENT_COLORS.inquiry;
            return (
              <div key={ev.id} className="flex gap-4 p-4 hover:bg-[var(--color-bg-workspace)]/50">
                <div className={`w-1 rounded-full shrink-0 ${color.bg}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-sm font-black">{ev.title}</h4>
                    <Badge variant={ev.type === 'gig' ? 'success' : ev.type === 'dead' ? 'rose' : 'warning'}>
                      {ev.status || ev.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(ev.date)}</p>
                  {ev.value != null && ev.value > 0 && (
                    <p className="text-xs font-bold mt-1">Value: {formatInr(ev.value)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <NexusModal isOpen={open} onClose={() => setOpen(false)} title="Add Calendar Event" showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Date *" type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          <label className="text-xs font-bold block">
            Type
            <select
              className="w-full mt-1 border rounded px-2 py-1.5 text-xs"
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
            >
              {Object.keys(CALENDAR_EVENT_COLORS).map((key) => (
                <option key={key} value={key}>{CALENDAR_EVENT_COLORS[key].label}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Save</Button>
          </div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
