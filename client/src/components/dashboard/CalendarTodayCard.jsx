import React from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { DashboardWidgetShell, DataListRow, Badge } from '../ui';
import { formatEventRangeLabel } from '../../utils/calendarEventTime';

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
      actions={<Badge variant="info">{calendar.length}</Badge>}
    >
      {calendar.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] font-medium italic text-center py-6 px-4">
          No events planned for today
        </p>
      ) : (
        <div className="-mx-4">
          {calendar.map((event) => (
            <DataListRow
              key={event._id}
              primary={
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold tracking-tight text-[var(--color-text-primary)]">
                    {event.title}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase shrink-0">
                    {event.visibility || 'private'}
                  </span>
                </div>
              }
              secondary={
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-medium">
                  <Clock size={12} /> {formatEventRangeLabel(event.date || event.dueDate, event.endDate)}
                </div>
              }
            />
          ))}
        </div>
      )}
    </DashboardWidgetShell>
  );
};

export default CalendarTodayCard;
