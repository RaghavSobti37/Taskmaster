const CRM_DIGEST_PLAN_OPTIONS = ['One-Time', '3 Mo', '6 Mo', '9 Mo'];

const CRM_DIGEST_SEGMENTS = {
  academy: {
    key: 'academy',
    workspace: 'TSC ACADEMY',
    namePattern: /^tsc academy$/i,
    crmType: 'sales',
    label: 'TSC Academy',
    digestTitle: 'Academy business (month)',
  },
  films: {
    key: 'films',
    workspace: 'TSC FILMS',
    namePattern: /^tsc films$/i,
    crmType: 'artist',
    label: 'TSC Films',
    digestTitle: 'Artist business (month)',
  },
};

const normalizeWorkspace = (value) => String(value || '').trim().toUpperCase();
const normalizeProjectName = (value) => String(value || '').trim();

const getCrmDigestSegmentForProject = (project) => {
  if (!project) return null;
  const name = normalizeProjectName(project.name);
  const workspace = normalizeWorkspace(project.workspace);
  for (const segment of Object.values(CRM_DIGEST_SEGMENTS)) {
    if (segment.namePattern.test(name)) return segment;
    if (workspace && workspace === segment.workspace) return segment;
  }
  return null;
};

const getCrmDigestSegmentForWorkspace = (workspaceName) => {
  const normalized = normalizeWorkspace(workspaceName);
  for (const segment of Object.values(CRM_DIGEST_SEGMENTS)) {
    if (normalized === segment.workspace) return segment;
  }
  return null;
};

export {
  CRM_DIGEST_PLAN_OPTIONS,
  CRM_DIGEST_SEGMENTS,
  getCrmDigestSegmentForProject,
  getCrmDigestSegmentForWorkspace,
};
