import React from 'react';
import { UserAvatar } from '../ui/UserAvatar';

const departmentLabel = (user) => {
  if (!user) return '';
  return user.departmentId?.name || user.department?.name || '';
};

const MentionUserChip = ({ label, user, displayName }) => {
  const chipLabel = label || displayName || '';
  const resolvedName = user?.name || displayName || chipLabel;
  const dept = departmentLabel(user);

  return (
    <span className="relative inline group/mention align-baseline">
      <span className="tm-mention-chip cursor-default">@{chipLabel}</span>
      {user && (
        <span
          className="absolute left-0 bottom-full z-[120] hidden w-max max-w-[220px] pb-1.5 group-hover/mention:block pointer-events-none"
          role="tooltip"
        >
          <span className="flex items-center gap-2.5 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-3 py-2 shadow-lg">
            <UserAvatar user={user} size="sm" />
            <span className="min-w-0 flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight truncate">
                {resolvedName}
              </span>
              {dept ? (
                <span className="text-[10px] text-[var(--color-text-muted)] leading-tight truncate">
                  {dept}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

export default MentionUserChip;
