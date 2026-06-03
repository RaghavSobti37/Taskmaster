import React from 'react';
import { Badge } from '../ui';
import { UserLabel } from '../ui/UserAvatar';
import ScheduleMemberTaskGrid from './ScheduleMemberTaskGrid';

const ScheduleMemberRow = ({
  member,
  placement,
  slotCount,
  memberPad,
  cellPad,
  cellAlign,
  avatarSize,
  compact,
  workspaces,
  projects,
  onTaskClick,
  isCurrentUser = false,
  isClusterMember = false,
}) => {
  const uid = member._id?.toString();
  const lanes = placement?.lanes || [];
  const tooltip = placement?.tooltip || '';
  const taskCount = placement?.taskCount || 0;
  const avatarSizeKey = compact ? 'xs' : 'sm';

  return (
    <tr
      key={uid}
      className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/30"
    >
      <td className={`${memberPad} ${cellAlign}`}>
        <div className="flex items-center gap-1 min-w-0">
          <UserLabel
            user={member}
            size={avatarSizeKey}
            nameClassName="font-semibold text-[11px] truncate"
            className="min-w-0 flex-1"
          />
          {isCurrentUser && (
            <Badge
              variant="todo"
              className="!text-[8px] !py-0 !px-1.5 shrink-0 !bg-[var(--color-brand-teal)]/15 !text-[var(--color-brand-teal)]"
            >
              You
            </Badge>
          )}
        </div>
      </td>
      <td
        colSpan={slotCount}
        className={`p-0 ${cellAlign} overflow-hidden ${isClusterMember ? 'border-l border-[var(--color-bg-border)]/30' : ''}`}
        title={taskCount > 0 ? tooltip : undefined}
      >
        <ScheduleMemberTaskGrid
          lanes={lanes}
          slotCount={slotCount}
          cellPad={cellPad}
          compact={compact}
          workspaces={workspaces}
          projects={projects}
          onTaskClick={onTaskClick}
        />
      </td>
    </tr>
  );
};

export default ScheduleMemberRow;
