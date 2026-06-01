export const DEFAULT_WORKSPACE_COLOR = '#64748b';

export const PRESET_WORKSPACE_COLORS = [
  '#3498db', '#9b59b6', '#e74c3c', '#2ecc71', '#f97316',
  '#ec4899', '#06b6d4', '#eab308', '#64748b', '#8b5cf6',
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalize #RGB / #RRGGBB to lowercase #rrggbb. Returns null if invalid. */
export function normalizeHexColor(value, fallback = null) {
  const trimmed = String(value ?? '').trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    return fallback;
  }
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function isValidHexColor(value) {
  return normalizeHexColor(value) !== null;
}

export function normalizeWorkspaceKey(name) {
  return String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function buildWorkspaceColorMap(workspaces = []) {
  const map = {};
  workspaces.forEach((w) => {
    if (w?.name) map[normalizeWorkspaceKey(w.name)] = w.color || DEFAULT_WORKSPACE_COLOR;
  });
  return map;
}

function findWorkspaceEntry(workspaceName, workspaces = []) {
  const key = normalizeWorkspaceKey(workspaceName);
  if (!key) return null;

  const exact = workspaces.find((w) => normalizeWorkspaceKey(w.name) === key);
  if (exact) return exact;

  // e.g. project "TECH" → workspace "TSC TECH"
  return (
    workspaces.find((w) => {
      const wn = normalizeWorkspaceKey(w.name);
      if (!wn) return false;
      return (
        wn.endsWith(` ${key}`) ||
        wn.endsWith(key) ||
        key.endsWith(wn) ||
        key.includes(wn) ||
        wn.includes(key)
      );
    }) || null
  );
}

export function getWorkspaceColor(workspaceName, workspacesOrMap) {
  const key = normalizeWorkspaceKey(workspaceName || 'General') || 'GENERAL';

  if (workspacesOrMap instanceof Map) {
    return workspacesOrMap.get(key) || DEFAULT_WORKSPACE_COLOR;
  }
  if (Array.isArray(workspacesOrMap)) {
    const entry = findWorkspaceEntry(key, workspacesOrMap);
    return entry?.color || DEFAULT_WORKSPACE_COLOR;
  }
  if (workspacesOrMap && typeof workspacesOrMap === 'object') {
    return workspacesOrMap[key] || DEFAULT_WORKSPACE_COLOR;
  }
  return DEFAULT_WORKSPACE_COLOR;
}

/** Which workspace name applies to this task (project is source of truth when linked). */
export function getTaskWorkspace(task, project) {
  const fromProject = project?.workspace ?? (typeof task?.projectId === 'object' ? task?.projectId?.workspace : null);
  if (fromProject) return fromProject;
  if (task?.workspace) return task.workspace;
  return 'General';
}

export function findTaskProject(task, projects = []) {
  if (!task) return null;
  const populated = task.projectId;
  const pid = populated?._id || populated;

  if (pid && projects?.length) {
    const fromList = projects.find((p) => String(p._id) === String(pid));
    if (fromList) return fromList;
  }

  if (populated && typeof populated === 'object') return populated;
  return null;
}

export function resolveTaskWorkspaceColor(task, workspaces, projects = []) {
  const project = findTaskProject(task, projects);
  const workspaceName = getTaskWorkspace(task, project);
  return getWorkspaceColor(workspaceName, workspaces);
}

export function getWorkspaceAccentStyle(color) {
  return { '--workspace-accent': color || DEFAULT_WORKSPACE_COLOR };
}

/** Tinted row background + left accent bar. */
export function getTaskRowStyle(workspaceColor, borderWidth = 3) {
  const accent = workspaceColor || DEFAULT_WORKSPACE_COLOR;
  return {
    ...getWorkspaceAccentStyle(accent),
    backgroundColor: `color-mix(in srgb, ${accent} 28%, var(--color-bg-surface))`,
    borderLeft: `${borderWidth}px solid ${accent}`,
  };
}

/** Muted grey styling for completed tasks (project task list / kanban). */
export function getCompletedTaskRowStyle(borderWidth = 3) {
  return {
    backgroundColor: 'var(--color-pastel-slate-bg)',
    borderLeft: `${borderWidth}px solid var(--color-pastel-slate-text)`,
  };
}
