import React from 'react';
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
}) => {
  const uid = member._id?.toString();
  const lanes = placement?.lanes || [];
  const tooltip = placement?.tooltip || '';
  const taskCount = placement?.taskCount || 0;

  return (
    <tr
      key={uid}
      className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/30"
    >
      <td className={`${memberPad} ${cellAlign}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`${avatarSize} rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-bold shrink-0 overflow-hidden select-none`}
          >
            {member.avatar ? (
              <img src={member.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              member.name?.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="font-semibold text-[11px] truncate">{member.name}</div>
        </div>
      </td>
      <td colSpan={slotCount} className={`p-0 ${cellAlign} overflow-hidden`} title={taskCount > 0 ? tooltip : undefined}>
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
