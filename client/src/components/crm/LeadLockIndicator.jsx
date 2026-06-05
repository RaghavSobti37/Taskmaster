import React from 'react';
import { Lock } from 'lucide-react';

export default function LeadLockIndicator({ lead, currentUserId }) {
  const lockedBy = lead?.lockedBy;
  if (!lockedBy) return null;
  if (currentUserId && String(lockedBy) === String(currentUserId)) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-[var(--color-text-muted)]"
      title="Being edited by another user"
    >
      <Lock size={12} strokeWidth={2} />
    </span>
  );
}
