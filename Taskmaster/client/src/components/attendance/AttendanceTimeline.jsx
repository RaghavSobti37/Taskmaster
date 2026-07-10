import React, { useMemo } from 'react';
import {
  getWorkedMinutesFromEntry,
  getUnloggedMinutesFromEntry,
  LUNCH_BREAK_MINUTES,
  parseClockToMinutes,
} from '../../utils/attendanceMetrics';
import { formatMinuteGap } from '../../utils/timeSpent';

const DAY_MINUTES = 24 * 60;

const pct = (minutes, total = DAY_MINUTES) =>
  Math.min(100, Math.max(0, (minutes / total) * 100));

export default function AttendanceTimeline({
  entry,
  loggedMinutesOverride,
  compact = false,
  className = '',
}) {
  const segments = useMemo(() => {
    const inTime = entry?.inTimeRecord?.manualTimestamp;
    const outTime = entry?.outTimeRecord?.manualTimestamp;
    if (!inTime || !outTime) return null;

    const startMin = parseClockToMinutes(inTime);
    const endMin = parseClockToMinutes(outTime);
    const worked = getWorkedMinutesFromEntry(entry);
    const unlogged = getUnloggedMinutesFromEntry(entry, { loggedMinutesOverride });
    const lunchStart = startMin + Math.max(0, (worked - LUNCH_BREAK_MINUTES) / 2);
    const lunchEnd = lunchStart + LUNCH_BREAK_MINUTES;

    return {
      startMin,
      endMin,
      worked,
      unlogged,
      lunchStart,
      lunchEnd,
      startPct: pct(startMin),
      spanPct: pct(worked),
      lunchStartPct: pct(lunchStart),
      lunchSpanPct: pct(LUNCH_BREAK_MINUTES),
      gapPct: pct(unlogged, Math.max(worked - LUNCH_BREAK_MINUTES, 1)),
    };
  }, [entry, loggedMinutesOverride]);

  if (!segments) return null;

  const barH = compact ? 'h-2' : 'h-3';
  const label = `Worked ${formatMinuteGap(segments.worked)} from check-in to check-out, `
    + `${LUNCH_BREAK_MINUTES} minute lunch break, `
    + (segments.unlogged > 0 ? `${formatMinuteGap(segments.unlogged)} not logged` : 'fully logged');

  return (
    <div className={`space-y-1.5 ${className}`} role="img" aria-label={label}>
      <div className={`relative w-full ${barH} rounded-full bg-[var(--color-bg-border)] overflow-hidden`}>
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--color-action-primary)]/25"
          style={{ left: `${segments.startPct}%`, width: `${segments.spanPct}%` }}
        />
        <div
          className="absolute inset-y-0 attendance-timeline-lunch"
          style={{ left: `${segments.lunchStartPct}%`, width: `${segments.lunchSpanPct}%` }}
          title="Lunch break (60 min)"
        />
        {segments.unlogged > 0 && (
          <div
            className="absolute inset-y-0 bg-[var(--color-pastel-rose-text)]/35 border-l border-r border-[var(--color-pastel-rose-text)]/50"
            style={{
              left: `${segments.startPct + segments.spanPct * 0.55}%`,
              width: `${Math.min(segments.gapPct, segments.spanPct * 0.35)}%`,
            }}
            title={`${formatMinuteGap(segments.unlogged)} not logged`}
          />
        )}
      </div>
      {!compact && (
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] tabular-nums">
          <span>{entry.inTimeRecord.manualTimestamp}</span>
          <span>{entry.outTimeRecord.manualTimestamp}</span>
        </div>
      )}
    </div>
  );
}
