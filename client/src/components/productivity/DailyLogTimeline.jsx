import React, { useMemo } from 'react';
import {
  getLogTimelineDisplay,
  minutesToClock,
  parseClockToMinutes,
} from '../../utils/dailyLogDetails';
import { formatAttendanceRecordTime } from '../../utils/attendanceUtils';

const COLORS = [
  'bg-blue-500/70',
  'bg-indigo-500/70',
  'bg-violet-500/70',
  'bg-cyan-500/70',
  'bg-emerald-500/70',
  'bg-amber-500/70',
];

const pct = (minutes, start, span) =>
  Math.min(100, Math.max(0, ((minutes - start) / span) * 100));

const formatBlockRange = (block) => {
  const range = `${minutesToClock(block.startMin)} – ${minutesToClock(block.endMin)}`;
  return block.estimated ? `~${range}` : range;
};

const attendanceRecordToMinutes = (record) => {
  const clock = formatAttendanceRecordTime(record);
  return clock ? parseClockToMinutes(clock) : null;
};

export default function DailyLogTimeline({ logs = [], attendanceEntry = null, className = '' }) {
  const attendanceInMin = attendanceRecordToMinutes(attendanceEntry?.inTimeRecord);
  const attendanceOutMin = attendanceRecordToMinutes(attendanceEntry?.outTimeRecord);

  const {
    firstIn,
    lastOut,
    blocks,
    laneCount,
    rangeStart,
    rangeEnd,
    span,
  } = useMemo(
    () => getLogTimelineDisplay(logs, { attendanceInMin, attendanceOutMin }),
    [logs, attendanceInMin, attendanceOutMin],
  );

  const attendanceIn = formatAttendanceRecordTime(attendanceEntry?.inTimeRecord);
  const attendanceOut = formatAttendanceRecordTime(attendanceEntry?.outTimeRecord);
  const headerIn = attendanceIn || (firstIn != null ? minutesToClock(firstIn) : '--');
  const headerOut = attendanceOut || (lastOut != null ? minutesToClock(lastOut) : '--');

  const trackHeight = Math.max(32, laneCount * 14 + 8);
  const laneShare = 100 / laneCount;

  if (!logs.length) {
    return (
      <section className={`p-4 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)]/30 ${className}`}>
        <h4 className="tm-widget-label mb-2">Day timeline</h4>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          No logs for this day yet.
        </p>
      </section>
    );
  }

  return (
    <section className={`p-4 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)]/30 space-y-3 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h4 className="tm-widget-label">Day timeline</h4>
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">
            Time In {headerIn}
          </span>
          <span className="text-rose-500">
            Time Out {headerOut}
          </span>
        </div>
      </div>

      <div
        className="relative rounded-full bg-[var(--color-bg-border)] overflow-hidden"
        style={{ height: trackHeight }}
      >
        {blocks.map((block, i) => {
          const left = pct(block.startMin, rangeStart, span);
          const right = pct(block.endMin, rangeStart, span);
          const width = Math.max(1.5, right - left);
          const top = block.lane * laneShare;
          return (
            <div
              key={block.id}
              className={`absolute rounded-md ${COLORS[i % COLORS.length]} border border-white/10`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `calc(${top}% + 2px)`,
                height: `calc(${laneShare}% - 4px)`,
              }}
              title={`${block.title} (${formatBlockRange(block)}${block.estimated ? ', estimated' : ''})`}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[9px] font-bold text-[var(--color-text-muted)] tabular-nums">
        <span>{minutesToClock(rangeStart)}</span>
        <span>{minutesToClock(rangeEnd)}</span>
      </div>

      <ul className="space-y-1.5 pt-1 border-t border-[var(--color-bg-border)]">
        {blocks.map((block, i) => (
          <li key={block.id} className="flex items-start gap-2 text-[10px]">
            <span className={`mt-1 w-2 h-2 rounded-sm shrink-0 ${COLORS[i % COLORS.length]}`} />
            <span
              className={`font-bold tabular-nums shrink-0 ${block.estimated ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}
              title={block.estimated ? 'Estimated from time spent and log time' : undefined}
            >
              {formatBlockRange(block)}
            </span>
            <span className="font-black text-[var(--color-text-primary)] truncate">{block.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
