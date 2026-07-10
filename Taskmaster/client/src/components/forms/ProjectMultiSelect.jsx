import React, { useMemo, useState } from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import WorkspaceSelect, { WorkspaceDot } from './WorkspaceSelect';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';

const ProjectMultiSelect = ({
  projects = [],
  value = [],
  onChange,
  label = 'Associated Projects',
  placeholder = 'Select projects...',
  className = '',
}) => {
  const { data: workspaces = [] } = useWorkspaces();
  const [workspaceFilter, setWorkspaceFilter] = useState('General');

  const selectedIds = useMemo(
    () => new Set((Array.isArray(value) ? value : []).map(String)),
    [value]
  );

  const options = useMemo(() => {
    const ws = String(workspaceFilter || 'General').toUpperCase();
    const inWorkspace = projects.filter(
      (p) => String(p.workspace || 'General').toUpperCase() === ws
    );
    const elsewhereSelected = projects.filter(
      (p) => selectedIds.has(String(p._id)) && !inWorkspace.some((x) => String(x._id) === String(p._id))
    );
    return [...inWorkspace, ...elsewhereSelected].map((p) => ({
      value: p._id,
      label: p.name,
      workspace: p.workspace,
    }));
  }, [projects, workspaceFilter, selectedIds]);

  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedIds.has(String(p._id))),
    [projects, selectedIds]
  );

  const renderOption = (option) => {
    const color = getWorkspaceColor(option.workspace, workspaces);
    return (
      <span className="flex items-center gap-2 min-w-0">
        <WorkspaceDot color={color} />
        <span className="truncate">{option.label}</span>
      </span>
    );
  };

  const removeProject = (projectId) => {
    onChange((Array.isArray(value) ? value : []).filter((id) => String(id) !== String(projectId)));
  };

  const triggerPlaceholder =
    selectedProjects.length > 0
      ? `${selectedProjects.length} project${selectedProjects.length === 1 ? '' : 's'} selected`
      : placeholder;

  return (
    <div className={`space-y-3 ${className}`}>
      <WorkspaceSelect
        value={workspaceFilter}
        onChange={setWorkspaceFilter}
        label="Workspace"
      />
      <NexusDropdown
        label={label}
        isMulti
        options={options}
        value={value}
        onChange={onChange}
        placeholder={triggerPlaceholder}
        renderOption={renderOption}
        searchable
      />
      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProjects.map((p) => {
            const color = getWorkspaceColor(p.workspace, workspaces);
            return (
              <span
                key={p._id}
                className="inline-flex items-center gap-1.5 max-w-full pl-1.5 pr-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
                style={{ borderLeft: `3px solid ${color}` }}
                title={`${p.name} · ${p.workspace || 'General'}`}
              >
                <WorkspaceDot color={color} />
                <span className="truncate">{p.name}</span>
                <button
                  type="button"
                  onClick={() => removeProject(p._id)}
                  className="shrink-0 text-[var(--color-text-muted)] hover:text-rose-500 leading-none"
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectMultiSelect;
