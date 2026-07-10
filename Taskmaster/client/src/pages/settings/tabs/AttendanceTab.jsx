import React from 'react';
import { Clock } from 'lucide-react';
import { DataLoading } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { useAttendance } from '../../../hooks/useTaskmasterQueries';
import { formatAttendanceRecordTime, formatDateKeyIST } from '../../../utils/attendanceUtils';

const getAttendanceRowClass = (row) => {
  if (row.onLeave) return 'bg-red-500/15 text-red-900 dark:text-red-100';
  if (row.isHalfDay) return 'bg-yellow-500/15 text-yellow-900 dark:text-yellow-100';
  return '';
};

const formatLegacyFlatTime = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
};

const getTimeInDisplay = (row) =>
  formatAttendanceRecordTime(row?.inTimeRecord)
  || formatLegacyFlatTime(row?.timeIn)
  || '-';

const getTimeOutDisplay = (row) =>
  formatAttendanceRecordTime(row?.outTimeRecord)
  || formatLegacyFlatTime(row?.timeOut)
  || '-';

export default function AttendanceTab() {
  const { user } = useAuth();
  const { data: myAttendance = [], isLoading } = useAttendance({ mine: true }, !!user);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="border-b border-[var(--color-bg-border)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Attendance</h1>
      </div>

      <section>
        <div className="pb-4 border-b border-[var(--color-bg-border)] mb-4">
          <h3 className="tm-widget-label flex items-center gap-2">
            <Clock size={14} className="text-emerald-500" /> Attendance History
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] custom-scrollbar">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
              <tr>
                <th className="px-4 py-3 text-left tm-widget-label !text-[10px]">Date</th>
                <th className="px-4 py-3 text-left tm-widget-label !text-[10px]">Time In</th>
                <th className="px-4 py-3 text-left tm-widget-label !text-[10px]">Time Out</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3}>
                    <DataLoading className="py-8" />
                  </td>
                </tr>
              ) : myAttendance.map((row) => (
                <tr key={row?._id} className={`border-b border-[var(--color-bg-border)] last:border-0 ${getAttendanceRowClass(row)}`}>
                  <td className="px-4 py-3 tabular-nums">{row.date ? formatDateKeyIST(row.date) : '-'}</td>
                  <td className="px-4 py-3 tabular-nums">{getTimeInDisplay(row)}</td>
                  <td className="px-4 py-3 tabular-nums">{getTimeOutDisplay(row)}</td>
                </tr>
              ))}
              {!isLoading && myAttendance.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center tm-data-meta">No attendance records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
