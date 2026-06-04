import React from 'react';
import CountBadge from '../ui/CountBadge';

/** Red ping when user has unread @mentions in task conversation. */
export default function TaskMentionBadge({ task, className = '' }) {
  const count = Number(task?.unreadMentions) || 0;
  if (count <= 0) return null;
  return (
    <CountBadge
      count={count}
      variant="rose"
      size="sm"
      pulse
      className={className}
      aria-label={`${count} unread mention${count === 1 ? '' : 's'}`}
    />
  );
}
