import NexusDropdown from '../ui/NexusDropdown';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getWorkspaceColor } from '../../utils/workspaceColors';

export const WorkspaceDot = ({ color, className = '' }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
    style={{ backgroundColor: color }}
  />
);

const normalizeWorkspaceOptionKey = (name) => String(name || 'General').trim().toUpperCase();

const mergeWorkspaceOptions = (...groups) => {
  const byName = new Map();
  groups.flat().filter(Boolean).forEach((workspace) => {
    const name = typeof workspace === 'string' ? workspace : workspace.name;
    if (!name) return;
    const key = normalizeWorkspaceOptionKey(name);
    if (!byName.has(key)) {
      byName.set(key, typeof workspace === 'string' ? { name } : workspace);
    }
  });
  return [...byName.values()];
};

const WorkspaceSelect = ({
  value,
  onChange,
  label = 'Workspace',
  disabled = false,
  placeholder = 'Select workspace...',
  className = '',
  required = false,
  invalid = false,
  workspaces: providedWorkspaces,
  fallbackWorkspaces = [],
}) => {
  const { data: fetchedWorkspaces = [] } = useWorkspaces();
  const effectiveWorkspaces = mergeWorkspaceOptions(
    providedWorkspaces?.length ? providedWorkspaces : fetchedWorkspaces,
    fallbackWorkspaces,
    value ? [{ name: value }] : [],
    [{ name: 'General' }],
  );

  const options = effectiveWorkspaces.map((w) => ({
    value: w.name,
    label: w.name,
    color: w.color,
  }));

  const renderOption = (option) => (
    <span className="flex items-center gap-2 min-w-0">
      <WorkspaceDot color={option.color || getWorkspaceColor(option.value, effectiveWorkspaces)} />
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
