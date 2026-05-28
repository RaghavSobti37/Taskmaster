/** Display format for project names — always ALL CAPS */
export const formatProjectName = (name) => {
  if (name == null || name === '') return name ?? '';
  return String(name).toUpperCase().trim();
};

export const normalizeProject = (project) => {
  if (!project || typeof project !== 'object') return project;
  if (!project.name) return project;
  return { ...project, name: formatProjectName(project.name) };
};

export const normalizeProjects = (projects) => {
  if (!Array.isArray(projects)) return projects;
  return projects.map(normalizeProject);
};

/** Uppercase populated `project` on docs (finance, tasks, etc.) */
export const normalizePopulatedProject = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  if (!doc.project || typeof doc.project !== 'object') return doc;
  return { ...doc, project: normalizeProject(doc.project) };
};

export const normalizePopulatedProjectList = (items) => {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    let next = normalizePopulatedProject(item);
    if (Array.isArray(next.projectIds)) {
      next = { ...next, projectIds: normalizeProjects(next.projectIds) };
    }
    return next;
  });
};
