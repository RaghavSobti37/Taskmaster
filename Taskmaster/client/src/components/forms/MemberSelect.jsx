import React, { useMemo } from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { UserAvatar } from '../ui/UserAvatar';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { resolveUserDepartmentName } from '../../utils/taskAssigneeRows';

const normalizeMember = (m) => {
  if (!m) return null;
  const id = m._id || m.user?._id;
  if (!id) return null;
  const base = m.user || m;
  return {
    _id: id,
    name: base.name || 'Unknown',
    avatar: base.avatar,
    email: base.email,
    departmentId: base.departmentId,
    department: base.department,
  };
};

const MemberSelect = ({
  members: passedMembers,
  value,
  onChange,
  label = 'Assign To',
  disabled = false,
  placeholder = 'Assign to team members...',
  multi = true,
  className = '',
  lockedIds = [],
  excludeUserId = null,
  showAvatarAndDepartment = false,
}) => {
  const { data: fetchedMembers = [] } = useUserDirectory();
  const rawMembers = passedMembers || fetchedMembers;

  const members = useMemo(
    () => rawMembers.map(normalizeMember).filter(Boolean),
    [rawMembers]
  );

  const excludeId = excludeUserId != null ? String(excludeUserId) : null;

  const lockedSet = useMemo(
    () => new Set((lockedIds || []).map((id) => String(id))),
    [lockedIds]
  );

  const options = useMemo(
    () =>
      members
        .filter((m) => !excludeId || String(m._id) !== excludeId)
        .map((m) => {
          const dept = resolveUserDepartmentName(m);
          return {
            value: m._id,
            label: m.name,
            subtitle: dept,
            avatar: m.avatar,
            searchKey: `${m.name} ${dept} ${m.email || ''}`.toLowerCase(),
            disabled: lockedSet.has(String(m._id)),
          };
        }),
    [members, lockedSet, excludeId]
  );

  const handleChange = (next) => {
    const merged = [...new Set([...(lockedIds || []).map(String), ...(next || []).map(String)])];
    const filtered = excludeId ? merged.filter((id) => id !== excludeId) : merged;
    onChange(filtered);
  };

  const renderMemberOption = (option) => (
    <span className="flex items-center gap-2 min-w-0">
      <UserAvatar name={option.label} avatar={option.avatar} size="xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-bold text-[var(--color-text-primary)] leading-tight">
          {option.label}
        </span>
        {option.subtitle && (
          <span className="block truncate text-[9px] text-[var(--color-text-muted)] leading-tight">
            {option.subtitle}
          </span>
        )}
      </span>
    </span>
  );

  return (
    <NexusDropdown
      multi={multi}
      label={label}
      options={options}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      searchable
      renderOption={showAvatarAndDepartment ? renderMemberOption : null}
    />
  );
};

export default MemberSelect;
