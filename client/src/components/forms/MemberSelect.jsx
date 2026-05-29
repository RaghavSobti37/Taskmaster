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
}) => {
  const { data: fetchedMembers = [] } = useUserDirectory();
  const members = passedMembers || fetchedMembers;

  const options = useMemo(
    () => members.map((m) => ({
      value: m.user?._id || m._id,
      label: m.user?.name || m.name || 'Unknown',
    })),
    [members]
  );

  return (
    <NexusDropdown
      multi={multi}
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      searchable
    />
  );
};

export default MemberSelect;
