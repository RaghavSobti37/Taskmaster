import React from 'react';
import { Clock } from 'lucide-react';
import { Card } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { useAttendance } from '../../../hooks/useTaskmasterQueries';

const getAttendanceRowClass = (row) => {
  if (row.onLeave) return 'bg-red-500/15 text-red-900 dark:text-red-100';
  if (row.isHalfDay) return 'bg-yellow-500/15 text-yellow-900 dark:text-yellow-100';
  return '';
};

export default function AttendanceTab() {
  const { user } = useAuth();
  const { data: myAttendance = [] } = useAttendance({ mine: true }, !!user);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Attendance</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">View your daily check-in logs.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} className="text-emerald-500" /> Attendance History
          </h3>
        </div>
        <div className="p-4">
          <div className="max-h-96 overflow-y-auto border border-[var(--color-bg-border)] rounded-xl custom-scrollbar">
            <table className="min-w-full text-xs">
              <thead className="bg-[var(--color-bg-secondary)] sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Date</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Time In</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Time Out</th>
                </tr>
              </thead>
              <tbody>
                {myAttendance.map((row) => (
                  <tr key={row?._id} className={`border-t border-[var(--color-bg-border)] ${getAttendanceRowClass(row)}`}>
                    <td className="px-4 py-3">{row.date ? new Date(row.date).toISOString().slice(0, 10) : '-'}</td>
                    <td className="px-4 py-3">{row.timeIn || '-'}</td>
                    <td className="px-4 py-3">{row.timeOut || '-'}</td>
                  </tr>
                ))}
                {myAttendance.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-text-muted)]">No attendance records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
