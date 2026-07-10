import React from 'react';
import { History } from 'lucide-react';

const LeaderboardLastWeekRank = ({ rank, weekLabel }) => {
  if (rank == null) return null;

  const title = weekLabel
    ? `Rank ${rank} last month (${weekLabel})`
    : `Rank ${rank} last month`;

  return (
    <span
      className="inline-flex items-center gap-0.5 shrink-0 rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/80 px-1 py-px text-[9px] font-bold tabular-nums text-[var(--color-text-muted)]"
      title={title}
      aria-label={title}
    >
      <History size={9} className="opacity-70" aria-hidden />
      {rank}
    </span>
  );
};

export default LeaderboardLastWeekRank;
