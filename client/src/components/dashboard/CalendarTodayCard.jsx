import React from 'react';
import { Calendar as CalendarIcon, Clock, Video } from 'lucide-react';
import { DashboardWidgetShell, DataListRow, CountBadge } from '../ui';
import { formatEventRangeLabel, normalizeMeetingLink } from '../../utils/calendarEventTime';

/** Dashboard widget (componentId: schedule) — calendar events for today, not team task Schedule page. */
const CalendarTodayCard = ({ calendar = [], loading = false }) => {
  if (loading) {
    return (
      <DashboardWidgetShell title="Today's Calendar" icon={CalendarIcon}>
        <div className="space-y-3 -mx-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-[var(--color-bg-border)] space-y-2">
              <div className="h-3.5 bg-[var(--color-bg-border)] rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-[var(--color-bg-border)] rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      </DashboardWidgetShell>
    );
  }

  return (
    <DashboardWidgetShell
      bodyClassName="p-0"
      title="Today's Calendar"
      icon={CalendarIcon}
      actions={<CountBadge count={calendar.length} size="sm" variant="info" />}
    >
      {calendar.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] font-medium italic text-center py-6 px-4">
          No events planned for today
        </p>
      ) : (
        <div className="-mx-4">
          {calendar.map((event) => {
            const joinUrl = event.eventType === 'meeting' && event.meetingLink
              ? normalizeMeetingLink(event.meetingLink)
              : '';
            return (
              <DataListRow
                key={event._id}
                primary={
                  <div className="flex justify-between items-start gap-2 min-w-0">
                    <span className="tm-data-primary text-xs truncate min-w-0">
                      {event.title}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-md uppercase shrink-0">
                      {event.visibility || 'private'}
                    </span>
                  </div>
                }
                secondary={
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tabular-nums min-w-0 truncate">
                      <Clock size={12} className="shrink-0" />
                      {formatEventRangeLabel(event.date || event.dueDate, event.endDate)}
                    </div>
                    {joinUrl && (
                      <a
                        href={joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide tabular-nums bg-amber-500 text-[var(--color-bg-primary)] hover:bg-amber-400 transition-colors"
                      >
                        <Video size={10} />
                        Join
                      </a>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </DashboardWidgetShell>
  );
};

export default CalendarTodayCard;
