import React from 'react';
import { Badge } from '../../components/ui';
import ScheduleMemberRow from './ScheduleMemberRow';

const ScheduleDepartmentHeader = ({ group, colSpan, isOwn = false }) => (
  <tr className="bg-[var(--color-bg-secondary)]/40">
    <td
      colSpan={colSpan}
      className="px-2.5 py-1.5 border-b border-t border-[var(--color-bg-border)] border-l-4 border-l-[var(--color-bg-border)]"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest">
          {group.department?.name || 'Unassigned'}
        </span>
        {isOwn && (
          <Badge variant="todo" className="!text-[8px] !py-0 !px-1.5 !bg-[var(--color-brand-teal)]/15 !text-[var(--color-brand-teal)]">
            You
          </Badge>
        )}
        <Badge variant="todo" className="!text-[8px] !py-0 !px-1.5">
          {group.users?.length || 0}
        </Badge>
      </div>
    </td>
  </tr>
);

const ScheduleOwnSection = ({
  ownMember,
  ownDepartment,
  ownMemberLanes,
  colSpan,
  slotCount,
  memberPad,
  cellPad,
  cellAlign,
  avatarSize,
  compact,
  workspaces,
  projects,
  onTaskClick,
}) => {
  if (!ownMember) return null;
  return (
    <React.Fragment key="schedule-own">
      <ScheduleDepartmentHeader
        group={{ department: ownDepartment, users: [ownMember] }}
        colSpan={colSpan}
        isOwn
      />
      <ScheduleMemberRow
        member={ownMember}
        placement={ownMemberLanes}
        slotCount={slotCount}
        memberPad={memberPad}
        cellPad={cellPad}
        cellAlign={cellAlign}
        avatarSize={avatarSize}
        compact={compact}
        workspaces={workspaces}
        projects={projects}
        onTaskClick={onTaskClick}
      />
    </React.Fragment>
  );
};

export { ScheduleDepartmentHeader };
export default ScheduleOwnSection;
