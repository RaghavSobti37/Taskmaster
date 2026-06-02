import React, { useMemo } from 'react';
import { useProjects } from '../../hooks/useTaskmasterQueries';
import { normalizeWorkspaceKey } from '../../utils/workspaceColors';

const ChannelProjectLinksPicker = ({
  workspace,
  selectedIds = [],
  onChange,
  disabled = false,
}) => {
  const { data: projects = [] } = useProjects();

  const projectOptions = useMemo(() => {
    if (!workspace) return [];
    const ws = normalizeWorkspaceKey(workspace);
    return projects.filter((p) => normalizeWorkspaceKey(p.workspace || 'GENERAL') === ws);
  }, [projects, workspace]);

  const toggle = (id) => {
    if (disabled) return;
    const sid = String(id);
    onChange(
      selectedIds.includes(sid)
        ? selectedIds.filter((x) => x !== sid)
        : [...selectedIds, sid]
    );
  };

  if (!workspace) {
    return (
      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
        Select a workspace first to link projects.
      </p>
    );
  }

  if (projectOptions.length === 0) {
    return (
      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
        No projects in this workspace. This will be a general channel.
      </p>
    );
  }

  return (
    <div className="mt-1 max-h-36 overflow-y-auto space-y-1 custom-scrollbar rounded-lg border border-[var(--color-bg-border)] p-1.5 bg-[var(--color-bg-secondary)]">
      {projectOptions.map((p) => {
        const id = String(p._id);
        const checked = selectedIds.includes(id);
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(id)}
            className={`w-full text-left px-2 py-1.5 rounded-md text-[12px] flex items-center gap-2 ${
              checked
                ? 'bg-[var(--color-action-primary)]/15 border border-[var(--color-action-primary)]/40 font-semibold'
                : 'hover:bg-[var(--color-bg-surface)] border border-transparent'
            } disabled:opacity-50`}
          >
            <span
              className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[9px] ${
                checked
                  ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white'
                  : 'border-[var(--color-bg-border)]'
              }`}
            >
              {checked ? '✓' : ''}
            </span>
            <span className="truncate">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ChannelProjectLinksPicker;
