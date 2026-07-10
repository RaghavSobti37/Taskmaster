import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatDisplayDateTimeSeconds } from '../../utils/dateDisplay';

/**
 * Relative time with absolute timestamp on hover (title).
 */
const RelativeTimestamp = ({ value, className = '', showAbsolute = false }) => {
  if (!value) return <span className={className}>—</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className={className}>—</span>;

  const relative = formatDistanceToNow(date, { addSuffix: true });
  const absolute = formatDisplayDateTimeSeconds(date, { emptyLabel: '' });

  if (showAbsolute) {
    return (
      <time dateTime={date.toISOString()} className={className}>
        {absolute}
        <span className="text-[var(--color-text-muted)]"> · {relative}</span>
      </time>
    );
  }

  return (
    <time dateTime={date.toISOString()} title={absolute} className={className}>
      {relative}
    </time>
  );
};

export default RelativeTimestamp;
