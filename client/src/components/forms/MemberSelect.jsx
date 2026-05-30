import React, { useMemo } from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';

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
}) => {
  const { data: fetchedMembers = [] } = useUserDirectory();
  const members = passedMembers || fetchedMembers;

  const lockedSet = useMemo(
    () => new Set((lockedIds || []).map((id) => String(id))),
    [lockedIds]
  );

  const options = useMemo(
    () => members.map((m) => ({
      value: m.user?._id || m._id,
      label: m.user?.name || m.name || 'Unknown',
      disabled: lockedSet.has(String(m.user?._id || m._id)),
    })),
    [members, lockedSet]
  );

  const handleChange = (next) => {
    const merged = [...new Set([...(lockedIds || []).map(String), ...(next || []).map(String)])];
    onChange(merged);
  };

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
    />
  );
};

export default MemberSelect;
