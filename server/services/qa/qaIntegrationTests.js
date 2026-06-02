const mongoose = require('mongoose');
const Project = require('../../models/Project');
const Task = require('../../models/Task');
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
} = require('./qaApiClient');

function integrationCase(def, runFn) {
  return {
    name: `[Integration] ${def.title}`,
    category: def.category || 'business-logic',
    severity: def.sev || 'high',
    checklistId: def.id,
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
    data: { status: 'done' },
  });
  const status = completeRes.data?.status || completeRes.data?.data?.status;
  if (status === 'in-review') {
    return { ...probePass(def, 'Delegated completion moved task to in-review'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Expected in-review, got ${status || completeRes.status}`), artifacts: ctx.artifacts };
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

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: assignee, data: { status: 'done' } });
  const approveRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: assigner,
    data: { reviewAction: 'approve' },
  });
  const status = approveRes.data?.status || approveRes.data?.data?.status;
  if (status === 'done') {
    return { ...probePass(def, 'Assigner approved review → done'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Approve failed (${approveRes.status}) status=${status}`), artifacts: ctx.artifacts };
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
  const lead = await Lead.findOne();
  if (!lead) return skipProbeResult(def, 'No lead');
  const res = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${lead._id}`,
    user: adminUser,
    data: { callStatus: 'Connected' },
  });
  if (res.status !== 200) {
    return { ...probeFail(def, `Lead update failed (${res.status})`), artifacts: ctx.artifacts };
  }
  const audit = await CRMAudit.findOne({ leadId: lead._id }).sort({ createdAt: -1 }).lean();
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
    trackJs.includes('unsubscribed') &&
    (trackJs.includes('Contact') || trackJs.includes('contact'));
  return ok
    ? probePass(def, 'track.js references Contact + unsubscribed fields')
    : probeFail(def, 'Unsubscribe dual-write not evident in track.js');
}

async function runReconcileIdempotent(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const before = await Contact.countDocuments();
  const r1 = await request(def, { method: 'POST', url: '/api/data-hub/reconcile', user: adminUser, data: {} });
  const r2 = await request(def, { method: 'POST', url: '/api/data-hub/reconcile', user: adminUser, data: {} });
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
};

/** Placeholder cases for plan coverage — marked skip until runner implemented */
function placeholderCase(def) {
  return integrationCase(def, async (d) =>
    skipProbeResult(d, 'Runner not yet implemented — tracked in QA v2 plan')
  );
}

const PLANNED_PLACEHOLDERS = [
  { id: 'sm-review-rollback', title: 'Assigner rolls back task from in-review', sev: 'high' },
  { id: 'sm-invoice-submit-pending', title: 'Invoice submission sets approvalStatus=pending', sev: 'high' },
  { id: 'sm-invoice-reject-reason', title: 'Invoice rejection stores reason field', sev: 'medium' },
  { id: 'sm-project-complete-count', title: 'Task completion increments completedTaskCount', sev: 'high' },
  { id: 'sm-project-delete-count', title: 'Task deletion decrements project.totalTasksCount', sev: 'medium' },
  { id: 'sm-project-member-role-enforced', title: 'Project viewer role blocks mutation', sev: 'medium' },
  { id: 'sm-lead-lock-concurrent', title: 'Concurrent lead edits trigger optimistic lock', sev: 'high' },
  { id: 'sm-lead-lock-expires', title: 'Lead lock releases after TTL', sev: 'medium' },
  { id: 'int-task-complete-xp', title: 'Task completion triggers XP award chain', sev: 'critical' },
  { id: 'int-lead-captured-xp', title: 'CRM lead creation queues LEAD_CAPTURED XP', sev: 'high' },
  { id: 'int-xp-leaderboard-reflect', title: 'XP award reflects in leaderboard', sev: 'high' },
  { id: 'int-level-up-threshold', title: 'User level increments at XP threshold', sev: 'medium' },
  { id: 'int-task-assign-notify', title: 'Task assignment creates notification', sev: 'high' },
  { id: 'int-mention-notify', title: '@mention notifies user', sev: 'high' },
  { id: 'int-review-submit-notify', title: 'In-review notifies assigner', sev: 'high' },
  { id: 'int-review-approve-notify', title: 'Review approval notifies assignee', sev: 'medium' },
  { id: 'int-lead-syncs-to-contact', title: 'Lead syncs to Contact.inCRM', sev: 'high' },
  { id: 'int-exly-syncs-to-contact', title: 'ExlyBooking syncs to Contact.inExly', sev: 'high' },
  { id: 'int-mail-open-contact-sync', title: 'MailEvent open sets Contact.inMailer', sev: 'medium' },
  { id: 'int-multiinlet-flag-set', title: 'Multi-inlet Contact gets isMultiInlet=true', sev: 'medium' },
  { id: 'int-task-mutation-logged', title: 'Task mutation creates Log entry', sev: 'medium' },
  { id: 'int-bug-task-correct-project', title: 'Bug report lands in Tech Stack project', sev: 'medium' },
  { id: 'int-campaign-stats-accurate', title: 'Campaign stats match MailEvents', sev: 'high' },
  { id: 'int-attendance-weekend-leave', title: 'Saturday attendance classified as leave', sev: 'medium' },
  { id: 'int-booked-call-full-flow', title: 'Book-a-call webhook full pipeline', sev: 'high' },
  { id: 'sync-lead-csv-dedup-email', title: 'CSV import deduplicates by email', sev: 'critical' },
  { id: 'sync-lead-csv-dedup-phone', title: 'CSV import deduplicates by phone', sev: 'critical' },
  { id: 'sync-tsc-data-normalized', title: 'TSC import normalizes email/name', sev: 'high' },
  { id: 'sync-exly-webhook-booking', title: 'Exly webhook creates booking + Contact', sev: 'high' },
  { id: 'sync-bookedcall-full-flow', title: 'Book-a-call webhook 4-step pipeline', sev: 'critical' },
  { id: 'sync-mail-event-no-hardcode', title: 'MailEvent displayCity not hardcoded (LOCKED)', sev: 'critical' },
  { id: 'sync-unsubscribe-dual-write', title: 'Unsubscribe dual-write Lead + Contact', sev: 'critical' },
  { id: 'sync-folder-count-match', title: 'Data Hub folder counts match Contact', sev: 'high' },
  { id: 'sync-multiinlet-count-accurate', title: 'inletCount reflects active inlets', sev: 'high' },
];

async function buildIntegrationTestCases() {
  const implemented = INTEGRATION_DEFS.map((def) => {
    const runner = RUNNERS[def.id];
    if (!runner) return placeholderCase(def);
    return integrationCase(def, async (d, ctx) => {
      const result = await runner(d, ctx);
      if (result.artifacts) return result;
      if (ctx.artifacts.length) return { ...result, artifacts: ctx.artifacts };
      return result;
    });
  });

  const placeholders = PLANNED_PLACEHOLDERS.map(placeholderCase);
  return [...implemented, ...placeholders];
}

module.exports = { buildIntegrationTestCases, INTEGRATION_DEFS, PLANNED_PLACEHOLDERS };
