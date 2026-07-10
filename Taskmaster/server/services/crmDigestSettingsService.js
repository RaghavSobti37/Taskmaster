const Project = require('../models/Project');
const ProjectGoal = require('../domains/projects/models/ProjectGoal');
const WorkspaceGoal = require('../domains/projects/models/WorkspaceGoal');
const {
  CRM_DIGEST_SEGMENTS,
  CRM_DIGEST_PLAN_OPTIONS,
  emptyCrmDigestSettings,
  getCrmDigestSegmentForProject,
  normalizePlanValues,
} = require('../../shared/crmDigestProjects.cjs');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const BYPASS = bypassOptions('crm-digest-settings');

const readCrmDigestFromGoal = (goalDoc, segment) => {
  const stored = goalDoc?.crmDigest || {};
  const monthlyTargetLakhs = Number(stored.monthlyTargetLakhs);
  return {
    monthlyTargetLakhs: Number.isFinite(monthlyTargetLakhs) && monthlyTargetLakhs > 0
      ? monthlyTargetLakhs
      : 0,
    planValues: normalizePlanValues(stored.planValues),
    crmType: stored.crmType || segment.crmType,
  };
};

async function findProjectForSegment(segmentKey) {
  const segment = CRM_DIGEST_SEGMENTS[segmentKey];
  if (!segment) return null;
  const projects = await Project.find({
    $or: [
      { workspace: segment.workspace },
      { name: { $regex: segment.namePattern } },
    ],
  })
    .select('name workspace')
    .lean()
    .setOptions(BYPASS);

  return projects.find((project) => getCrmDigestSegmentForProject(project)?.key === segmentKey) || null;
}

async function loadSegmentDigestSettings(segmentKey) {
  const segment = CRM_DIGEST_SEGMENTS[segmentKey];
  if (!segment) return null;

  const project = await findProjectForSegment(segmentKey);
  if (!project) {
    return {
      segmentKey,
      segment,
      projectId: null,
      projectName: segment.label,
      settings: emptyCrmDigestSettings(segment.crmType),
      source: 'default',
    };
  }

  const goal = await ProjectGoal.findOne({ projectId: project._id })
    .select('crmDigest')
    .lean()
    .setOptions(BYPASS);

  const envTarget = Number.parseFloat(String(process.env.CRM_DIGEST_MONTHLY_TARGET_LAKHS || '').trim());
  const settings = readCrmDigestFromGoal(goal, segment);

  const workspaceGoal = await WorkspaceGoal.findOne({ workspaceName: segment.workspace })
    .select('crmDigest')
    .lean()
    .setOptions(BYPASS);
  const workspaceTargetLakhs = Number(workspaceGoal?.crmDigest?.monthlyTargetLakhs);
  if (Number.isFinite(workspaceTargetLakhs) && workspaceTargetLakhs > 0) {
    settings.monthlyTargetLakhs = workspaceTargetLakhs;
  } else if (!settings.monthlyTargetLakhs && segmentKey === 'academy' && Number.isFinite(envTarget) && envTarget > 0) {
    settings.monthlyTargetLakhs = envTarget;
  }

  if (segmentKey === 'academy' && !Object.values(settings.planValues).some((v) => v > 0)) {
    const raw = (process.env.CRM_DIGEST_PLAN_VALUES || '').trim();
    if (raw) {
      try {
        settings.planValues = normalizePlanValues(JSON.parse(raw));
      } catch (_) {
        // ponytail: env fallback only when project goal unset
      }
    }
  }

  return {
    segmentKey,
    segment,
    projectId: String(project._id),
    projectName: project.name,
    settings,
    source: workspaceGoal?.crmDigest?.monthlyTargetLakhs
      ? 'workspace'
      : (goal?.crmDigest ? 'project' : 'fallback'),
  };
}

async function loadCrmDigestConfig() {
  const [academy, films] = await Promise.all([
    loadSegmentDigestSettings('academy'),
    loadSegmentDigestSettings('films'),
  ]);
  return { academy, films };
}

module.exports = {
  loadCrmDigestConfig,
  loadSegmentDigestSettings,
  findProjectForSegment,
  readCrmDigestFromGoal,
};
