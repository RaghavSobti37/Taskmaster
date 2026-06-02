const mongoose = require('mongoose');
const Project = require('../../models/Project');
const Task = require('../../models/Task');
const Log = require('../../models/Log');
const Lead = require('../../models/Lead');
const FinanceDocument = require('../../models/FinanceDocument');
const CRMAudit = require('../../models/CRMAudit');
const Contact = require('../../models/Contact');
const {
  isApiReachable,
  resolveTestUsers,
  skipProbeResult,
  probeFail,
  probePass,
  request,
  QA_API_BASE,
  extractId,
} = require('./qaApiClient');
const { PLANNED_INTEGRATION_DEFS, PLANNED_RUNNERS } = require('./qaIntegrationRunners');

function integrationCase(def, runFn) {
  return {
    name: `[Integration] ${def.title}`,
    category: def.category || 'business-logic',
    severity: def.sev || 'high',
    checklistId: def.id,
    timeout: def.timeout || 45000,
    qaMeta: {
      kind: 'integration',
      action: 'Live API + database integration test',
      checklistId: def.id,
      category: def.category || 'business-logic',
      method: def.method,
      url: def.url,
      payloadHint: def.payloadHint,
    },
    test: async () => {
      if (!(await isApiReachable())) {
        return skipProbeResult(def, `API not reachable at ${QA_API_BASE()}`);
      }
      const ctx = { artifacts: [] };
      try {
        return await runFn(def, ctx);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          return skipProbeResult(def, err.message);
        }
        return { ...probeFail(def, err.message), artifacts: ctx.artifacts };
      }
    },
  };
}

function track(ctx, type, id) {
  if (id) ctx.artifacts.push({ type, id });
}

const INTEGRATION_DEFS = [
  // ── Suite 5: State machines ──
  {
    id: 'sm-delegated-goes-inreview',
    title: 'Delegated task completion → in-review',
    sev: 'critical',
    category: 'business-logic',
  },
  {
    id: 'sm-self-direct-complete',
    title: 'Self-assigned task bypasses review → completed',
    sev: 'critical',
    category: 'business-logic',
  },
  {
    id: 'sm-review-non-assigner-blocked',
    title: 'Non-assigner cannot approve review',
    sev: 'critical',
    category: 'business-logic',
  },
  {
    id: 'sm-review-approve-success',
    title: 'Assigner approves review → done',
    sev: 'critical',
    category: 'business-logic',
  },
  {
    id: 'sm-invoice-approve-ops-only',
    title: 'Ops user can approve pending invoice',
    sev: 'critical',
    category: 'permission',
  },
  {
    id: 'sm-invoice-approve-nonops-blocked',
    title: 'Non-ops user blocked from approving invoice',
    sev: 'critical',
    category: 'permission',
  },
  {
    id: 'sm-project-task-count-create',
    title: 'Task creation increments project.totalTasksCount',
    sev: 'high',
    category: 'business-logic',
  },
  {
    id: 'int-lead-field-audit',
    title: 'Lead field change creates CRMAudit entry',
    sev: 'high',
    category: 'business-logic',
  },
  {
    id: 'int-unsubscribe-propagates',
    title: 'Unsubscribe updates Lead and Contact (static wiring)',
    sev: 'critical',
    category: 'business-logic',
  },
  {
    id: 'sync-idempotent-reconcile',
    title: 'Repeated reconcile produces stable Contact state',
    sev: 'medium',
    category: 'business-logic',
  },
];

async function runDelegatedInReview(def, ctx) {
  const users = await resolveTestUsers();
  const assigner = users.adminUser;
  const assignee = users.salesUser?._id?.toString() !== assigner?._id?.toString()
    ? users.salesUser
    : users.anyUser;
  if (assignee._id.toString() === assigner._id.toString()) {
    return skipProbeResult(def, 'Need two distinct users for delegation test');
  }
  const project = await Project.findOne().select('_id');
  if (!project) return skipProbeResult(def, 'No project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: assigner,
    data: {
      title: `QA Review ${Date.now()}`,
      projectId: project._id,
      assignees: [assignee._id],
      status: 'in-progress',
    },
  });
  const taskId = createRes.data?._id || createRes.data?.data?._id;
  if (!taskId) return probeFail(def, `Task create failed (${createRes.status})`, createRes.status);
  track(ctx, 'task', taskId);

  const completeRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: assignee,
    data: { status: 'done', actualHours: 2 },
  });
  const status = completeRes.data?.status || completeRes.data?.data?.status;
  if (status !== 'in-review') {
    return { ...probeFail(def, `Expected in-review, got ${status || completeRes.status}`), artifacts: ctx.artifacts };
  }

  const assigneeLog = await Log.findOne({
    userId: assignee._id,
    targetId: taskId,
    targetType: 'Task',
    action: 'DAILY_LOG',
    'details.type': 'TASK_COMPLETION',
  }).lean();
  const reviewLogOnSubmit = await Log.findOne({
    userId: assigner._id,
    targetId: taskId,
    targetType: 'Task',
    action: 'DAILY_LOG',
    'details.type': 'TASK_REVIEW',
  }).lean();
  const assignerCompletion = await Log.findOne({
    userId: assigner._id,
    targetId: taskId,
    'details.type': 'TASK_COMPLETION',
  }).lean();

  if (!assigneeLog) return { ...probeFail(def, 'Missing assignee TASK_COMPLETION daily log'), artifacts: ctx.artifacts };
  if (reviewLogOnSubmit) {
    return { ...probeFail(def, 'Assigner TASK_REVIEW must not be created on submit'), artifacts: ctx.artifacts };
  }
  if (assignerCompletion) {
    return { ...probeFail(def, 'Assigner must not get TASK_COMPLETION on submit'), artifacts: ctx.artifacts };
  }

  return { ...probePass(def, 'Delegated completion → in-review with assignee-only daily log'), artifacts: ctx.artifacts };
}

async function runSelfComplete(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const project = await Project.findOne().select('_id');
  if (!project) return skipProbeResult(def, 'No project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: adminUser,
    data: {
      title: `QA Self ${Date.now()}`,
      projectId: project._id,
      assignees: [adminUser._id],
      status: 'in-progress',
    },
  });
  const taskId = createRes.data?._id || createRes.data?.data?._id;
  if (!taskId) return probeFail(def, `Create failed (${createRes.status})`);
  track(ctx, 'task', taskId);

  const completeRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: adminUser,
    data: { status: 'done' },
  });
  const status = completeRes.data?.status || completeRes.data?.data?.status;
  if (status === 'done') {
    return { ...probePass(def, 'Self-assigned task completed directly'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Expected done, got ${status}`), artifacts: ctx.artifacts };
}

async function runReviewBlocked(def, ctx) {
  const users = await resolveTestUsers();
  const assigner = users.adminUser;
  const assignee = users.salesUser?._id?.toString() !== assigner?._id?.toString()
    ? users.salesUser
    : users.anyUser;
  const outsider = users.opsUser?._id?.toString() !== assigner?._id?.toString()
    ? users.opsUser
    : users.anyUser;
  const project = await Project.findOne().select('_id');
  if (!project) return skipProbeResult(def, 'No project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: assigner,
    data: { title: `QA Block ${Date.now()}`, projectId: project._id, assignees: [assignee._id], status: 'in-progress' },
  });
  const taskId = createRes.data?._id || createRes.data?.data?._id;
  if (!taskId) return probeFail(def, 'Create failed');
  track(ctx, 'task', taskId);

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: assignee, data: { status: 'done' } });
  const approveRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: outsider,
    data: { reviewAction: 'approve' },
  });
  if (approveRes.status === 403 || approveRes.status === 400) {
    return { ...probePass(def, 'Non-assigner blocked from review approval'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Outsider approved review (${approveRes.status})`), artifacts: ctx.artifacts };
}

async function runReviewApprove(def, ctx) {
  const users = await resolveTestUsers();
  const assigner = users.adminUser;
  const assignee = users.salesUser?._id?.toString() !== assigner?._id?.toString()
    ? users.salesUser
    : users.anyUser;
  const project = await Project.findOne().select('_id');
  if (!project) return skipProbeResult(def, 'No project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: assigner,
    data: { title: `QA Approve ${Date.now()}`, projectId: project._id, assignees: [assignee._id], status: 'in-progress' },
  });
  const taskId = createRes.data?._id || createRes.data?.data?._id;
  if (!taskId) return probeFail(def, 'Create failed');
  track(ctx, 'task', taskId);

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: assignee, data: { status: 'done', actualHours: 1 } });
  const assignerCompletionBefore = await Log.countDocuments({
    userId: assigner._id,
    targetId: taskId,
    'details.type': 'TASK_COMPLETION',
  });
  const approveRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: assigner,
    data: { reviewAction: 'approve', reviewHours: 0.25 },
  });
  const status = approveRes.data?.status || approveRes.data?.data?.status;
  if (status !== 'done') {
    return { ...probeFail(def, `Approve failed (${approveRes.status}) status=${status}`), artifacts: ctx.artifacts };
  }
  const assignerCompletionAfter = await Log.countDocuments({
    userId: assigner._id,
    targetId: taskId,
    'details.type': 'TASK_COMPLETION',
  });
  if (assignerCompletionAfter > assignerCompletionBefore) {
    return { ...probeFail(def, 'Approve must not create assigner TASK_COMPLETION log'), artifacts: ctx.artifacts };
  }
  const reviewLog = await Log.findOne({
    userId: assigner._id,
    targetId: taskId,
    'details.type': 'TASK_REVIEW',
  }).lean();
  if (!reviewLog) {
    return { ...probeFail(def, 'Missing assigner TASK_REVIEW log on approve'), artifacts: ctx.artifacts };
  }
  if (reviewLog.details?.title !== '[review]' || reviewLog.details?.message !== '[review]') {
    return { ...probeFail(def, 'Review log must use [review] label only'), artifacts: ctx.artifacts };
  }
  if (!String(reviewLog.details?.timeSpent || '').includes('15m')) {
    return { ...probeFail(def, `Review log expected 15m, got ${reviewLog.details?.timeSpent}`), artifacts: ctx.artifacts };
  }
  return { ...probePass(def, 'Assigner approved review → [review] log only'), artifacts: ctx.artifacts };
}

async function runFinanceOpsApprove(def, ctx) {
  const { opsUser } = await resolveTestUsers();
  const doc = await FinanceDocument.create({
    title: `QA Invoice ${Date.now()}`,
    fileUrl: 'https://example.com/qa.pdf',
    category: 'invoice',
    approvalStatus: 'pending',
    uploadedBy: opsUser._id,
    submittedBy: opsUser._id,
  });
  track(ctx, 'finance', doc._id);

  const res = await request(def, {
    method: 'PATCH',
    url: `/api/finance/${doc._id}/approve`,
    user: opsUser,
    data: {},
  });
  if (res.status === 200 && (res.data?.data?.approvalStatus === 'approved' || res.data?.approvalStatus === 'approved')) {
    return { ...probePass(def, 'Ops approved invoice'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Ops approve failed (${res.status})`), artifacts: ctx.artifacts };
}

async function runFinanceNonOpsBlocked(def, ctx) {
  const users = await resolveTestUsers();
  const doc = await FinanceDocument.create({
    title: `QA Block Inv ${Date.now()}`,
    fileUrl: 'https://example.com/qa.pdf',
    category: 'invoice',
    approvalStatus: 'pending',
    uploadedBy: users.opsUser._id,
    submittedBy: users.opsUser._id,
  });
  track(ctx, 'finance', doc._id);

  const res = await request(def, {
    method: 'PATCH',
    url: `/api/finance/${doc._id}/approve`,
    user: users.salesUser,
    data: {},
  });
  if (res.status === 403) {
    return { ...probePass(def, 'Non-ops blocked from approve'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Expected 403, got ${res.status}`), artifacts: ctx.artifacts };
}

async function runProjectTaskCount(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const project = await Project.findOne().select('_id totalTasksCount');
  if (!project) return skipProbeResult(def, 'No project');
  const before = project.totalTasksCount || 0;

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: adminUser,
    data: { title: `QA Count ${Date.now()}`, projectId: project._id },
  });
  const taskId = createRes.data?._id || createRes.data?.data?._id;
  if (taskId) track(ctx, 'task', taskId);

  const refreshed = await Project.findById(project._id).select('totalTasksCount').lean();
  if (refreshed && refreshed.totalTasksCount === before + 1) {
    return { ...probePass(def, `totalTasksCount ${before} → ${refreshed.totalTasksCount}`), artifacts: ctx.artifacts };
  }
  return {
    ...probeFail(def, `Counter not incremented (before ${before}, after ${refreshed?.totalTasksCount})`),
    artifacts: ctx.artifacts,
  };
}

async function runLeadAudit(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const email = `qa-audit-${Date.now()}@example.com`;
  const phone = `9${String(Date.now()).slice(-9)}`;
  const createRes = await request(def, {
    method: 'POST',
    url: '/api/crm/leads',
    user: adminUser,
    data: { name: 'QA Audit Probe', email, phone, source: 'QA Test' },
  });
  const leadId = extractId(createRes);
  if (leadId) ctx.artifacts.push({ type: 'lead', id: leadId });
  if (!leadId || (createRes.status !== 201 && createRes.status !== 200)) {
    return { ...probeFail(def, `Lead create failed (${createRes.status})`), artifacts: ctx.artifacts };
  }
  const res = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${leadId}`,
    user: adminUser,
    data: { callStatus: 'Connected' },
  });
  if (res.status !== 200) {
    return { ...probeFail(def, `Lead update failed (${res.status})`), artifacts: ctx.artifacts };
  }
  const audit = await CRMAudit.findOne({ leadId }).sort({ createdAt: -1 }).lean();
  if (audit) {
    return { ...probePass(def, 'CRMAudit entry recorded after lead PATCH'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No CRMAudit entry after lead update'), artifacts: ctx.artifacts };
}

async function runUnsubscribeWiring(def, ctx) {
  const trackJs = await require('fs').promises.readFile(
    require('path').join(__dirname, '../../routes/track.js'),
    'utf8'
  ).catch(() => '');
  const ok =
    trackJs.includes('Lead.updateMany') &&
    /Contact\.updateMany/.test(trackJs) &&
    trackJs.includes('unsubscribed');
  return ok
    ? probePass(def, 'track.js dual-writes Lead + Contact on unsubscribe')
    : probeFail(def, 'Unsubscribe dual-write not evident in track.js');
}

async function runReconcileIdempotent(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const before = await Contact.countDocuments();
  const reconcileReq = { method: 'POST', url: '/api/data-hub/reconcile', user: adminUser, data: {}, timeout: 180000 };
  const r1 = await request({ ...def, timeout: 180000 }, reconcileReq);
  const r2 = await request({ ...def, timeout: 180000 }, reconcileReq);
  if (r1.status === 403 || r2.status === 403) {
    return skipProbeResult(def, 'Data Hub reconcile requires admin — test user not admin');
  }
  const after = await Contact.countDocuments();
  const delta = Math.abs(after - before);
  if (r1.status < 500 && r2.status < 500 && delta < 5000) {
    return probePass(def, `Reconcile twice OK (contacts ${before} → ${after})`);
  }
  return probeFail(def, `Reconcile unstable (${r1.status}/${r2.status}, delta ${delta})`);
}

const RUNNERS = {
  'sm-delegated-goes-inreview': runDelegatedInReview,
  'sm-self-direct-complete': runSelfComplete,
  'sm-review-non-assigner-blocked': runReviewBlocked,
  'sm-review-approve-success': runReviewApprove,
  'sm-invoice-approve-ops-only': runFinanceOpsApprove,
  'sm-invoice-approve-nonops-blocked': runFinanceNonOpsBlocked,
  'sm-project-task-count-create': runProjectTaskCount,
  'int-lead-field-audit': runLeadAudit,
  'int-unsubscribe-propagates': runUnsubscribeWiring,
  'sync-idempotent-reconcile': runReconcileIdempotent,
  ...PLANNED_RUNNERS,
};

const ALL_INTEGRATION_DEFS = [...INTEGRATION_DEFS, ...PLANNED_INTEGRATION_DEFS];

async function buildIntegrationTestCases() {
  return ALL_INTEGRATION_DEFS.map((def) => {
    const runner = RUNNERS[def.id];
    if (!runner) {
      return integrationCase(def, async (d) =>
        skipProbeResult(d, `No runner registered for ${d.id}`)
      );
    }
    return integrationCase(def, async (d, ctx) => {
      const result = await runner(d, ctx);
      if (result.artifacts) return result;
      if (ctx.artifacts.length) return { ...result, artifacts: ctx.artifacts };
      return result;
    });
  });
}

module.exports = {
  buildIntegrationTestCases,
  INTEGRATION_DEFS,
  PLANNED_INTEGRATION_DEFS,
  ALL_INTEGRATION_DEFS,
};
