import React from 'react';

const PING_STYLES = {
  review: {
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
    label: 'Review',
  },
  overdue: {
    className: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40',
    label: 'Overdue',
  },
};

const ProjectStatusPing = ({ type, count, className = '' }) => {
  const n = Number(count) || 0;
  if (n <= 0) return null;

  const style = PING_STYLES[type];
  if (!style) return null;

  const title = `${n} task${n === 1 ? '' : 's'} ${type === 'review' ? 'awaiting your review' : 'overdue'}`;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border shrink-0 ${style.className} ${className}`}
      title={title}
    >
      {style.label} {n}
    </span>
  );
};

export const projectCardAccentClass = ({ reviewCount = 0, overdueCount = 0 } = {}) => {
  if (overdueCount > 0) return 'border-l-2 border-l-rose-500 bg-rose-500/5';
  if (reviewCount > 0) return 'border-l-2 border-l-amber-500 bg-amber-500/5';
  return '';
};

export const ProjectCardStatusOverlay = ({ reviewCount = 0, overdueCount = 0, className = '' }) => {
  if (!reviewCount && !overdueCount) return null;

  return (
    <div className={`flex items-center gap-1 shrink-0 ${className}`}>
      <ProjectStatusPing type="overdue" count={overdueCount} />
      <ProjectStatusPing type="review" count={reviewCount} />
    </div>
  );
};

export default ProjectStatusPing;
