import React from 'react';

const HEX =
  'M18 3 L32 11.5 L32 28.5 L18 37 L4 28.5 L4 11.5 Z';

const INNER_HEX =
  'M18 7 L28 13.5 L28 26.5 L18 33 L8 26.5 L8 13.5 Z';

const TIER_STYLES = {
  1: {
    fillStart: '#e8f4fc',
    fillMid: '#cfe9f8',
    fillEnd: '#b9e6ff',
    stroke: '#93c5fd',
    innerStroke: '#bae6fd',
    accent: '#38bdf8',
    accentLight: '#e0f2fe',
    glow: '#7dd3fc',
    text: '#0c4a6e',
  },
  2: {
    fillStart: '#e5e7eb',
    fillMid: '#d1d5db',
    fillEnd: '#9ca3af',
    stroke: '#9ca3af',
    innerStroke: '#e5e7eb',
    accent: '#6b7280',
    accentLight: '#f3f4f6',
    glow: '#d1d5db',
    text: '#374151',
  },
  3: {
    fillStart: '#fcd34d',
    fillMid: '#fbbf24',
    fillEnd: '#d97706',
    stroke: '#d97706',
    innerStroke: '#fde68a',
    accent: '#f59e0b',
    accentLight: '#fef3c7',
    glow: '#fbbf24',
    text: '#78350f',
  },
  4: {
    fillStart: '#d1d5db',
    fillMid: '#9ca3af',
    fillEnd: '#6b7280',
    stroke: '#6b7280',
    innerStroke: '#e5e7eb',
    accent: '#9ca3af',
    accentLight: '#f3f4f6',
    glow: '#9ca3af',
    text: '#374151',
  },
  5: {
    fillStart: '#d4a574',
    fillMid: '#b8860b',
    fillEnd: '#92400e',
    stroke: '#92400e',
    innerStroke: '#d4a574',
    accent: '#b45309',
    accentLight: '#fde68a',
    glow: '#d4a574',
    text: '#451a03',
  },
};

const SLATE_FALLBACK = {
  fillStart: '#475569',
  fillMid: '#3f4f63',
  fillEnd: '#334155',
  stroke: '#64748b',
  innerStroke: '#94a3b8',
  accent: '#64748b',
  accentLight: '#94a3b8',
  glow: '#64748b',
  text: '#e2e8f0',
};

const getTierStyle = (rank) => TIER_STYLES[rank] || SLATE_FALLBACK;

const BadgeShell = ({ children, rank, ornate = 0, tier = getTierStyle(rank) }) => (
  <svg
    width={36}
    height={40}
    viewBox="0 0 36 40"
    className="tm-leaderboard-rank-badge shrink-0"
    role="img"
    aria-label={`Rank ${rank}`}
  >
    <defs>
      <linearGradient id={`lb-hex-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tier.fillStart} />
        <stop offset="45%" stopColor={tier.fillMid} />
        <stop offset="100%" stopColor={tier.fillEnd} />
      </linearGradient>
      <linearGradient id={`lb-accent-${rank}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={tier.accentLight} />
        <stop offset="50%" stopColor={tier.accent} />
        <stop offset="100%" stopColor={tier.stroke} />
      </linearGradient>
      {ornate >= 2 && (
        <radialGradient id={`lb-glow-${rank}`} cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor={tier.glow} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tier.glow} stopOpacity="0" />
        </radialGradient>
      )}
    </defs>
    {ornate >= 2 && <ellipse cx="18" cy="20" rx="14" ry="16" fill={`url(#lb-glow-${rank})`} />}
    <path
      d={HEX}
      fill={`url(#lb-hex-${rank})`}
      stroke={tier.stroke}
      strokeWidth={ornate >= 1 ? 1.5 : 1}
    />
    <path
      d={INNER_HEX}
      fill="none"
      stroke={tier.innerStroke}
      strokeWidth={0.75}
      opacity={ornate >= 1 ? 0.7 : 0.4}
    />
    {children}
    <text
      x="18"
      y="22"
      textAnchor="middle"
      dominantBaseline="middle"
      fill={tier.text}
      fontSize={ornate >= 3 ? 13 : 12}
      fontWeight="800"
      fontFamily="system-ui, sans-serif"
    >
      {rank}
    </text>
  </svg>
);

/** Rank 5 — simplest hex shield */
const Rank5Badge = () => {
  const tier = TIER_STYLES[5];
  return (
    <BadgeShell rank={5} ornate={0} tier={tier}>
      <path d={HEX} fill="none" stroke={tier.stroke} strokeWidth={0.5} opacity={0.5} />
    </BadgeShell>
  );
};

/** Rank 4 — thin corner ticks */
const Rank4Badge = () => {
  const tier = TIER_STYLES[4];
  return (
    <BadgeShell rank={4} ornate={1} tier={tier}>
      <circle cx="18" cy="6" r="1.2" fill={tier.accentLight} opacity={0.8} />
      <circle cx="6" cy="20" r="0.9" fill={tier.accent} opacity={0.6} />
      <circle cx="30" cy="20" r="0.9" fill={tier.accent} opacity={0.6} />
    </BadgeShell>
  );
};

/** Rank 3 — side chevrons */
const Rank3Badge = () => {
  const tier = TIER_STYLES[3];
  return (
    <BadgeShell rank={3} ornate={2} tier={tier}>
      <path d="M2 18 L6 20 L2 22 Z" fill={tier.accent} opacity={0.85} />
      <path d="M34 18 L30 20 L34 22 Z" fill={tier.accent} opacity={0.85} />
      <path d="M18 1 L20 5 L16 5 Z" fill={tier.accentLight} />
    </BadgeShell>
  );
};

/** Rank 2 — wing flares + double rim */
const Rank2Badge = () => {
  const tier = TIER_STYLES[2];
  return (
    <BadgeShell rank={2} ornate={3} tier={tier}>
      <path d="M0 16 Q4 20 0 24 Z" fill={tier.accent} opacity={0.9} />
      <path d="M36 16 Q32 20 36 24 Z" fill={tier.accent} opacity={0.9} />
      <path d="M14 0 L18 4 L22 0 L20 3 L16 3 Z" fill={tier.accentLight} />
      <path d={HEX} fill="none" stroke={tier.innerStroke} strokeWidth={0.5} opacity={0.5} />
      <circle cx="18" cy="8" r="1.5" fill={tier.fillEnd} stroke={tier.accentLight} strokeWidth={0.5} />
    </BadgeShell>
  );
};

/** Rank 1 — crown, laurel hints, richest diamond ornament */
const Rank1Badge = () => {
  const tier = TIER_STYLES[1];
  return (
    <svg
      width={36}
      height={40}
      viewBox="0 0 36 40"
      className="tm-leaderboard-rank-badge shrink-0"
      role="img"
      aria-label="Rank 1"
    >
      <defs>
        <linearGradient id="lb-hex-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={tier.fillStart} />
          <stop offset="40%" stopColor={tier.fillMid} />
          <stop offset="100%" stopColor={tier.fillEnd} />
        </linearGradient>
        <linearGradient id="lb-accent-1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={tier.accentLight} />
          <stop offset="40%" stopColor={tier.accent} />
          <stop offset="100%" stopColor={tier.stroke} />
        </linearGradient>
        <radialGradient id="lb-glow-1" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor={tier.glow} stopOpacity="0.5" />
          <stop offset="100%" stopColor={tier.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="18" cy="18" rx="16" ry="18" fill="url(#lb-glow-1)" />
      <path d="M1 14 L5 18 L1 22 Z" fill="url(#lb-accent-1)" stroke={tier.accentLight} strokeWidth={0.4} />
      <path d="M35 14 L31 18 L35 22 Z" fill="url(#lb-accent-1)" stroke={tier.accentLight} strokeWidth={0.4} />
      <path d={HEX} fill="url(#lb-hex-1)" stroke="url(#lb-accent-1)" strokeWidth={2} />
      <path d={INNER_HEX} fill="none" stroke={tier.innerStroke} strokeWidth={1} opacity={0.85} />
      <path
        d="M10 2 L12 6 L14 3 L16 7 L18 2 L20 7 L22 3 L24 6 L26 2 L24 5 L12 5 Z"
        fill="url(#lb-accent-1)"
        stroke={tier.accentLight}
        strokeWidth={0.5}
      />
      <path d="M6 30 Q10 34 14 32" fill="none" stroke={tier.accent} strokeWidth={1.2} opacity={0.8} />
      <path d="M30 30 Q26 34 22 32" fill="none" stroke={tier.accent} strokeWidth={1.2} opacity={0.8} />
      <circle cx="18" cy="12" r="2" fill={tier.fillEnd} stroke={tier.accentLight} strokeWidth={0.6} />
      <text
        x="18"
        y="23"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={tier.text}
        fontSize={14}
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        1
      </text>
    </svg>
  );
};

const BADGES = {
  1: Rank1Badge,
  2: Rank2Badge,
  3: Rank3Badge,
  4: Rank4Badge,
  5: Rank5Badge,
};

const RankFallbackBadge = ({ rank }) => (
  <BadgeShell rank={rank} ornate={0} tier={SLATE_FALLBACK} />
);

const LeaderboardRankBadge = ({ rank }) => {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return <Rank5Badge />;
  if (n <= 5) {
    const Badge = BADGES[n];
    return <Badge />;
  }
  return <RankFallbackBadge rank={n} />;
};

export default LeaderboardRankBadge;
