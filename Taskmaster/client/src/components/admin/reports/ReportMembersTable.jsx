import React from 'react';
import { Badge, DataTable } from '../../ui';

const ReportMembersTable = ({ members = [] }) => (
  <section className="border-t border-[var(--color-bg-border)] overflow-hidden">
    <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        Members ({members.length})
      </p>
    </div>
    {members.length === 0 ? (
      <p className="p-4 text-xs text-[var(--color-text-muted)] opacity-60">No members in this report.</p>
    ) : (
      <DataTable
        className="!border-none !rounded-none"
        columns={[
      {
        header: 'Name',
        render: (row) => <span className="font-bold">{row.name}</span>,
      },
      {
        header: 'Present',
        render: (row) => (
          <span className="font-mono text-emerald-400">{row.attendance.present}</span>
        ),
      },
      {
        header: 'Half Days',
        render: (row) => (
          <span className="font-mono text-amber-400">{row.attendance.halfDay}</span>
        ),
      },
      {
        header: 'Leave',
        render: (row) => (
          <span className="font-mono text-rose-400">{row.attendance.leave}</span>
        ),
      },
      {
        header: 'Tasks Done',
        render: (row) => (
          <Badge variant="info">{row.tasks.completed}</Badge>
        ),
      },
      {
        header: 'Log Hours',
        render: (row) => (
          <span className="font-mono font-bold text-indigo-400">
            {row.logs.totalHours.toFixed(1)}h
          </span>
        ),
      },
      {
        header: 'Logs',
        render: (row) => (
          <Badge variant="slate">{row.logs.entryCount ?? '—'}</Badge>
        ),
      },
    ]}
    data={members}
    getRowId={(row) => row._id}
    paginated
      />
    )}
  </section>
);

export default ReportMembersTable;
