import React from 'react';

const formatDelta = (n) => (n > 0 ? `+${n}` : String(n));

export const hasLeaderboardRecalcHint = (member) =>
  member?.weeklyXpPrior != null
  && (member.weeklyXpDelta !== 0 || (member.recalcChanges?.length ?? 0) > 0);

/** Compact recalc summary — opens below the row on hover (avoids clipping at top of viewport). */
export const LeaderboardRecalcHover = ({ member, className = '' }) => {
  if (!hasLeaderboardRecalcHint(member)) return null;

  const { weeklyXpPrior, weeklyXp, weeklyXpDelta, recalcChanges = [] } = member;
  const preview = recalcChanges.slice(0, 6);
  const more = recalcChanges.length - preview.length;

  return (
    <div
      className={`pointer-events-none absolute z-[60] left-0 right-0 top-full mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ${className}`}
      role="tooltip"
    >
      <div className="rounded-lg border border-amber-500/40 bg-[var(--color-bg-primary)] shadow-xl px-3 py-2 text-left min-w-[min(100%,280px)]">
        <p className="text-[10px] font-bold text-amber-500">
          Was {weeklyXpPrior} XP → now {weeklyXp} XP ({formatDelta(weeklyXpDelta)})
        </p>
        {preview.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
            {preview.map((row, index) => (
              <li
                key={`${row.action}-${row.previousAmount}-${row.amount}-${row.delta}-${index}`}
                className="text-[9px] text-[var(--color-text-muted)] leading-snug"
              >
                <span className="text-[var(--color-text-primary)]">{row.actionLabel}</span>
                {': '}
                {row.previousAmount} → {row.amount} ({formatDelta(row.delta)})
              </li>
            ))}
          </ul>
        )}
        {more > 0 && (
          <p className="text-[9px] text-amber-500/90 mt-1 font-semibold">
            +{more} more · click row for full breakdown
          </p>
        )}
        {preview.length === 0 && (
          <p className="text-[9px] text-[var(--color-text-muted)] mt-1">Click row for full breakdown</p>
        )}
      </div>
    </div>
  );
};

export const LeaderboardUpdatedBadge = ({ lastRecalculatedAt, className = 'ml-2' }) => {
  if (!lastRecalculatedAt) return null;
  return (
    <span
      className={`${className} text-[9px] font-bold normal-case tracking-normal text-amber-600/90`}
      title="Click a row for full-screen breakdown; hover score for recalc preview"
    >
      · updated
    </span>
  );
};
