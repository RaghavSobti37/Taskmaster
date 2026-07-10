const Project = require('../models/Project');
const ProjectGoal = require('../models/ProjectGoal');
const WorkspaceGoal = require('../models/WorkspaceGoal');
const {
  aggregateProjectMetrics,
  METRIC_KEYS,
} = require('./projectGoalsService');

function resolveMetricValue(autoValue, override) {
  if (override?.enabled) return Number(override.value) || 0;
  return autoValue;
}

async function getOrCreateWorkspaceGoal(workspaceName) {
  const normalized = String(workspaceName || '').toUpperCase().trim();
  let goal = await WorkspaceGoal.findOne({ workspaceName: normalized });
  if (!goal) {
    goal = await WorkspaceGoal.create({
      workspaceName: normalized,
      targets: {
        sales: { target: 0 },
        totalReach: { target: 0 },
        warmLeads: { target: 0 },
        audienceExposure: { target: 0 },
      },
      crmDigest: { monthlyTargetLakhs: 0 },
    });
  }
  return goal;
}

async function getWorkspaceGoalProgress(workspaceName) {
  const normalized = String(workspaceName || '').toUpperCase().trim();
  const workspaceGoal = await getOrCreateWorkspaceGoal(normalized);
  const goalObj = workspaceGoal.toObject();

  const projects = await Project.find({ workspace: normalized })
    .select('name')
    .sort({ name: 1 })
    .lean();

  const projectBreakdown = [];
  const cumulative = Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));
  const projectTargetSum = Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));

  for (const project of projects) {
    const goal = await ProjectGoal.findOne({ projectId: project._id }).lean();
    const autoMetrics = await aggregateProjectMetrics(project._id, null, null, goal) || {};
    const overrides = goal?.metricOverrides || {};
    const current = {};
    const targets = {};
    for (const key of METRIC_KEYS) {
      current[key] = resolveMetricValue(autoMetrics[key] ?? 0, overrides[key]);
      targets[key] = goal?.targets?.[key]?.target || 0;
      cumulative[key] += current[key];
      projectTargetSum[key] += targets[key];
    }
    projectBreakdown.push({
      projectId: String(project._id),
      projectName: project.name,
      current,
      targets,
    });
  }

  const progress = {};
  for (const key of METRIC_KEYS) {
    progress[key] = {
      current: cumulative[key],
      target: goalObj.targets?.[key]?.target || 0,
      projectTargetSum: projectTargetSum[key],
    };
  }

  return {
    workspaceName: normalized,
    goal: goalObj,
    progress,
    projectBreakdown,
    projectCount: projects.length,
  };
}

async function updateWorkspaceGoal(workspaceName, payload, userId) {
  const goal = await getOrCreateWorkspaceGoal(workspaceName);

  if (payload.targets) {
    for (const key of METRIC_KEYS) {
      if (payload.targets[key]?.target != null) {
        goal.targets[key] = { target: Number(payload.targets[key].target) || 0 };
      }
    }
  }

  if (payload.crmDigest?.monthlyTargetLakhs != null) {
    const monthlyTargetLakhs = Number(payload.crmDigest.monthlyTargetLakhs);
    goal.crmDigest = {
      monthlyTargetLakhs: Number.isFinite(monthlyTargetLakhs) && monthlyTargetLakhs >= 0
        ? monthlyTargetLakhs
        : 0,
    };
  }

  goal.updatedBy = userId;
  await goal.save();
  return getWorkspaceGoalProgress(workspaceName);
}

module.exports = {
  getWorkspaceGoalProgress,
  updateWorkspaceGoal,
  getOrCreateWorkspaceGoal,
  METRIC_KEYS,
};
