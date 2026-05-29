import React, { useMemo } from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { WorkspaceDot } from './WorkspaceSelect';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';

const ProjectSelect = ({
  projects = [],
  value,
  onChange,
  workspaceFilter = null,
  label = 'Project',
  disabled = false,
  placeholder = 'Select project...',
  allowEmpty = false,
  emptyLabel = 'Personal',
  className = '',
}) => {
  const { data: workspaces = [] } = useWorkspaces();

  const options = useMemo(() => {
    const filtered = workspaceFilter
      ? projects.filter((p) => String(p.workspace || 'General').toUpperCase() === String(workspaceFilter).toUpperCase())
      : projects;
    const mapped = filtered.map((p) => ({
      value: p._id,
      label: p.name,
      workspace: p.workspace,
    }));
    if (allowEmpty) return [{ value: '', label: emptyLabel }, ...mapped];
    return mapped;
  }, [projects, workspaceFilter, allowEmpty, emptyLabel]);

  const renderOption = (option) => {
    if (!option.workspace) return option.label;
    const color = getWorkspaceColor(option.workspace, workspaces);
    return (
      <span className="flex items-center gap-2 min-w-0">
        <WorkspaceDot color={color} />
        <span className="truncate">{option.label}</span>
      </span>
    );
  };

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
    />
  );
};

export default ProjectSelect;
