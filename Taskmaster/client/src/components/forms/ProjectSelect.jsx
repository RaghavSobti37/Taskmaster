import React, { useMemo } from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { WorkspaceDot } from './WorkspaceSelect';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import { useWorkspaces, useWorkspace } from '../../hooks/useTaskmasterQueries';
import { projectInWorkspace } from './WorkspaceProjectFields';

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
  variant,
}) => {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: workspaceDetail } = useWorkspace(workspaceFilter, !!workspaceFilter);

  const options = useMemo(() => {
    const mergedById = new Map();
    projects.forEach((p) => mergedById.set(p._id, p));
    (workspaceDetail?.projects || []).forEach((p) => {
      if (!mergedById.has(p._id)) mergedById.set(p._id, p);
    });

    const pool = [...mergedById.values()];
    const filtered = workspaceFilter
      ? pool.filter((p) => projectInWorkspace(p, workspaceFilter))
      : pool;
    const mapped = filtered.map((p) => ({
      value: p._id,
      label: p.name,
      workspace: p.workspace,
    }));
    if (allowEmpty) return [{ value: '', label: emptyLabel }, ...mapped];
    return mapped;
  }, [projects, workspaceFilter, allowEmpty, emptyLabel, workspaceDetail?.projects]);

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
      variant={variant}
    />
  );
};

ProjectSelect.displayName = 'ProjectSelect';

export default ProjectSelect;
