import React from 'react';
import { Calendar } from 'lucide-react';
import { DataTable, Badge } from '../../ui';

const EVENT_VARIANT = {
  meeting: 'info',
  deadline: 'warning',
  holiday: 'success',
  reminder: 'slate',
};

const ReportCalendarTable = ({ events = [] }) => (
  <section className="border-t border-[var(--color-bg-border)] overflow-hidden">
    <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
        <Calendar size={12} /> Calendar Events ({events.length})
      </p>
    </div>
    {events.length === 0 ? (
      <p className="p-4 text-xs text-[var(--color-text-muted)] opacity-60">No calendar events this month.</p>
    ) : (
      <DataTable
        className="!border-none !rounded-none"
        columns={[
          {
            header: 'Date',
            render: (row) => <span className="font-mono text-[11px]">{row.date}</span>,
          },
          {
            header: 'Title',
            render: (row) => <span className="font-bold text-[11px]">{row.title}</span>,
          },
          {
            header: 'Type',
            render: (row) => {
              const type = (row.eventType || 'event').toLowerCase();
              return (
                <Badge variant={EVENT_VARIANT[type] || 'slate'} className="!text-[8px] uppercase">
                  {row.eventType || 'Event'}
                </Badge>
              );
            },
          },
        ]}
        data={events}
        getRowId={(row) => `${row.date}|${row.title}|${row.eventType || ''}`}
        paginated
      />
    )}
  </section>
);

export default ReportCalendarTable;
