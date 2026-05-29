export const DEFAULT_WORKSPACE_COLOR = '#64748b';

export function buildWorkspaceColorMap(workspaces = []) {
  const map = {};
  workspaces.forEach((w) => {
    if (w?.name) map[String(w.name).toUpperCase()] = w.color || DEFAULT_WORKSPACE_COLOR;
  });
  return map;
}

export function getWorkspaceColor(workspaceName, workspacesOrMap) {
  const key = String(workspaceName || 'General').toUpperCase();
  if (workspacesOrMap instanceof Map) return workspacesOrMap.get(key) || DEFAULT_WORKSPACE_COLOR;
  if (Array.isArray(workspacesOrMap)) {
    const found = workspacesOrMap.find((w) => String(w.name).toUpperCase() === key);
    return found?.color || DEFAULT_WORKSPACE_COLOR;
  }
  if (workspacesOrMap && typeof workspacesOrMap === 'object') {
    return workspacesOrMap[key] || DEFAULT_WORKSPACE_COLOR;
  }
  return DEFAULT_WORKSPACE_COLOR;
}

export function getTaskWorkspace(task, project) {
  return task?.workspace || project?.workspace || task?.projectId?.workspace || 'General';
}
