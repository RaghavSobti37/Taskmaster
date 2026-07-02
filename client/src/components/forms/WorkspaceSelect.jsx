import React from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getWorkspaceColor } from '../../utils/workspaceColors';

export const WorkspaceDot = ({ color, className = '' }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
    style={{ backgroundColor: color }}
  />
);

const WorkspaceSelect = ({ value, onChange, label = 'Workspace', disabled = false, placeholder = 'Select workspace...', className = '', required = false, invalid = false }) => {
  const { data: workspaces = [] } = useWorkspaces();

  const options = workspaces.map((w) => ({
    value: w.name,
    label: w.name,
    color: w.color,
  }));

  const renderOption = (option) => (
    <span className="flex items-center gap-2 min-w-0">
      <WorkspaceDot color={option.color || getWorkspaceColor(option.value, workspaces)} />
      <span className="truncate">{option.label}</span>
    </span>
  );

  return (
    <NexusDropdown
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      renderOption={renderOption}
      searchable
      required={required}
      invalid={invalid}
    />
  );
};

export default WorkspaceSelect;
