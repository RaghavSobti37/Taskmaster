import React from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Card, Badge } from '../ui';

const ScheduleCard = ({ calendar = [], loading = false }) => {
  if (loading) {
    return (
      <Card className="p-0 flex flex-col shadow-md overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <div className="h-4 w-32 bg-[var(--color-bg-border)] rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] space-y-2">
              <div className="h-3.5 bg-[var(--color-bg-border)] rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-[var(--color-bg-border)] rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden">
      <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <CalendarIcon size={16} className="text-blue-500" /> Today's Schedule
        </h4>
        <Badge variant="info">{calendar.length}</Badge>
      </div>
      <div className="p-4 space-y-3">
        {calendar.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] font-medium italic text-center py-6">
            No events planned for today
          </p>
        ) : (
          calendar.map(event => (
            <div 
              key={event._id} 
              className="flex flex-col p-3 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] gap-1.5 transition-colors hover:border-blue-500/30"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-bold tracking-tight text-[var(--color-text-primary)]">
                  {event.title}
                </span>
                <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase">
                  {event.visibility || 'private'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-medium">
                <Clock size={12} /> {event.time || 'All Day'}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default ScheduleCard;
