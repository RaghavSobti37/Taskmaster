/** CRM daily digest — TSC Academy (sales) and TSC Films (artist business). */

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

const emptyPlanValues = () =>
  Object.fromEntries(CRM_DIGEST_PLAN_OPTIONS.map((key) => [key, 0]));

const emptyCrmDigestSettings = (crmType = 'sales') => ({
  monthlyTargetLakhs: 0,
  planValues: emptyPlanValues(),
  crmType,
});

const normalizePlanValues = (raw = {}) => {
  const base = emptyPlanValues();
  for (const key of CRM_DIGEST_PLAN_OPTIONS) {
    const parsed = Number(raw[key]);
    base[key] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return base;
};

const getCrmDigestSegmentForWorkspace = (workspaceName) => {
  const normalized = normalizeWorkspace(workspaceName);
  for (const segment of Object.values(CRM_DIGEST_SEGMENTS)) {
    if (normalized === segment.workspace) return segment;
  }
  return null;
};

module.exports = {
  CRM_DIGEST_PLAN_OPTIONS,
  CRM_DIGEST_SEGMENTS,
  getCrmDigestSegmentForProject,
  getCrmDigestSegmentForWorkspace,
  emptyPlanValues,
  emptyCrmDigestSettings,
  normalizePlanValues,
};
