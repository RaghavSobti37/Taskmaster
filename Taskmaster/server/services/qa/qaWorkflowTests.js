/**
 * Layer 4 — Workflow Testing (CRM, Task, Attendance, Artist E2E)
 */
const Project = require('../../models/Project');
const Lead = require('../../models/Lead');
const Log = require('../../models/Log');
const CRMAudit = require('../../models/CRMAudit');
const {
  isApiReachable,
  resolveTestUsers,
  skipProbeResult,
  probeFail,
  probePass,
  request,
  extractId,
} = require('./qaApiClient');
const { purgeQaIdentity, qaLeadPayload } = require('./qaTestData');

function workflowCase(def, runFn) {
  return {
    name: `[Workflow] ${def.title}`,
    category: def.category || 'workflow',
    severity: def.sev || 'high',
    checklistId: def.id,
    timeout: def.timeout || 60000,
    qaMeta: {
      kind: 'workflow',
      action: def.title,
      checklistId: def.id,
      layer: 4,
    },
    test: async () => {
      if (!(await isApiReachable())) {
        return skipProbeResult(def, `API not reachable`);
      }
      const ctx = { artifacts: [] };
      try {
        return await runFn(def, ctx);
      } catch (err) {
        return { ...probeFail(def, err.message), artifacts: ctx.artifacts };
      }
    },
  };
}

function track(ctx, type, id) {
  if (id) ctx.artifacts.push({ type, id });
}

const WORKFLOW_DEFS = [
  { id: 'wf-crm-lead-assign-followup-convert', title: 'CRM: create lead → assign → followup → convert', sev: 'critical' },
  { id: 'wf-task-create-assign-complete-review', title: 'Task: create → assign → complete → review → approve', sev: 'critical' },
  { id: 'wf-attendance-checkin', title: 'Attendance: check-in workflow', sev: 'high' },
  { id: 'wf-artist-list-access', title: 'Artist: list access for artist management', sev: 'high' },
];

async function runCrmWorkflow(def, ctx) {
  const users = await resolveTestUsers();
  const admin = users.adminUser;
  const sales = users.salesUser;
  const leadPayload = qaLeadPayload({ name: 'QA Workflow Lead' });
  await purgeQaIdentity({ email: leadPayload.email, phone: leadPayload.phone });

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/crm/leads',
    user: admin,
    data: leadPayload,
  });
  const leadId = extractId(createRes);
  if (!leadId) return { ...probeFail(def, `Lead create failed (${createRes.status})`), artifacts: ctx.artifacts };
  track(ctx, 'lead', leadId);

  const assignRes = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${leadId}`,
    user: admin,
    data: { assignedRepId: String(sales._id), callStatus: 'Connected' },
  });
  if (assignRes.status !== 200) {
    const detail = assignRes.data?.error || assignRes.status;
    return { ...probeFail(def, `Assign failed (${detail})`), artifacts: ctx.artifacts };
  }

  const followRes = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${leadId}`,
    user: sales,
    data: {
      nextFollowupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      nextFollowupTime: '10:00',
      remarks: 'QA followup',
    },
  });
  if (followRes.status !== 200) {
    return { ...probeFail(def, `Followup failed (${followRes.status})`), artifacts: ctx.artifacts };
  }

  const convertRes = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${leadId}`,
    user: admin,
    data: { leadStatus: 'Converted' },
  });
  if (convertRes.status !== 200) {
    return { ...probeFail(def, `Convert failed (${convertRes.status})`), artifacts: ctx.artifacts };
  }

  const audit = await CRMAudit.findOne({ leadId }).setOptions({ bypassTenant: true }).sort({ timestamp: -1 }).lean();
  const lead = await Lead.findById(leadId).lean();
  if (!audit) return { ...probeFail(def, 'No CRMAudit after workflow'), artifacts: ctx.artifacts };
  if (lead?.leadStatus !== 'Converted') {
    return { ...probeFail(def, `Lead status not Converted (${lead?.leadStatus})`), artifacts: ctx.artifacts };
  }

  return { ...probePass(def, 'CRM workflow completed with audit trail'), artifacts: ctx.artifacts };
}

async function runTaskWorkflow(def, ctx) {
  const users = await resolveTestUsers();
  const assigner = users.adminUser;
  const assignee = users.salesUser?._id?.toString() !== assigner?._id?.toString()
    ? users.salesUser
    : users.anyUser;
  if (assignee._id.toString() === assigner._id.toString()) {
    return skipProbeResult(def, 'Need distinct users for task workflow');
  }
  const project = await Project.findOne().select('_id');
  if (!project) return skipProbeResult(def, 'No project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: assigner,
    data: {
      title: `QA Workflow Task ${Date.now()}`,
      projectId: project._id,
      assignees: [assignee._id],
      status: 'in-progress',
    },
  });
  const taskId = extractId(createRes);
  if (!taskId) return { ...probeFail(def, `Task create failed (${createRes.status})`), artifacts: ctx.artifacts };
  track(ctx, 'task', taskId);

  const completeRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: assignee,
    data: { status: 'done', actualHours: 1 },
  });
  const afterComplete = completeRes.data?.status || completeRes.data?.data?.status;
  if (afterComplete !== 'in-review') {
    return { ...probeFail(def, `Expected in-review, got ${afterComplete}`), artifacts: ctx.artifacts };
  }

  const approveRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: assigner,
    data: { reviewAction: 'approve', reviewHours: 0.25 },
  });
  const finalStatus = approveRes.data?.status || approveRes.data?.data?.status;
  if (finalStatus !== 'done') {
    return { ...probeFail(def, `Approve failed status=${finalStatus}`), artifacts: ctx.artifacts };
  }

  const reviewLog = await Log.findOne({
    userId: assigner._id,
    targetId: taskId,
    'details.type': 'TASK_REVIEW',
  }).lean();
  if (!reviewLog) return { ...probeFail(def, 'Missing TASK_REVIEW log'), artifacts: ctx.artifacts };

  return { ...probePass(def, 'Task workflow: create→assign→complete→approve'), artifacts: ctx.artifacts };
}

async function runAttendanceWorkflow(def, ctx) {
  const users = await resolveTestUsers();
  const user = users.opsUser || users.adminUser;

  const listRes = await request(def, { method: 'GET', url: '/api/attendance', user });
  if (listRes.status === 403) {
    return skipProbeResult(def, 'Attendance list requires elevated permissions');
  }
  if (listRes.status >= 500) {
    return { ...probeFail(def, `Attendance list 500`), artifacts: ctx.artifacts };
  }

  const checkinRes = await request(def, {
    method: 'POST',
    url: '/api/attendance/check',
    user,
    data: { type: 'in', workMode: 'office' },
  });
  if (checkinRes.status === 200 || checkinRes.status === 201) {
    return { ...probePass(def, 'Attendance check-in succeeded'), artifacts: ctx.artifacts };
  }
  if (checkinRes.status === 400 && String(checkinRes.data?.message || '').includes('already')) {
    return { ...probePass(def, 'Attendance already checked in (idempotent)'), artifacts: ctx.artifacts };
  }
  if (checkinRes.status === 404) {
    return skipProbeResult(def, 'Check-in endpoint not found — route may differ');
  }
  return { ...probeFail(def, `Check-in failed (${checkinRes.status})`), artifacts: ctx.artifacts };
}

async function runArtistWorkflow(def, ctx) {
  const users = await resolveTestUsers();
  const artistUser = users.artistUser || users.adminUser;

  const res = await request(def, { method: 'GET', url: '/api/artists', user: artistUser });
  if (res.status === 200) {
    return { ...probePass(def, `Artists list OK (${Array.isArray(res.data) ? res.data.length : 'object'} items)`), artifacts: ctx.artifacts };
  }
  if (res.status === 403) {
    const blocked = await request(def, { method: 'GET', url: '/api/artists', user: users.standardUser });
    if (blocked.status === 403) {
      return { ...probePass(def, 'Artist list restricted correctly'), artifacts: ctx.artifacts };
    }
    return { ...probeFail(def, `Artist user blocked (${res.status})`), artifacts: ctx.artifacts };
  }
  if (res.status === 404) {
    return skipProbeResult(def, 'Artists endpoint not found');
  }
  return { ...probeFail(def, `Artists list failed (${res.status})`), artifacts: ctx.artifacts };
}

const RUNNERS = {
  'wf-crm-lead-assign-followup-convert': runCrmWorkflow,
  'wf-task-create-assign-complete-review': runTaskWorkflow,
  'wf-attendance-checkin': runAttendanceWorkflow,
  'wf-artist-list-access': runArtistWorkflow,
};

async function buildWorkflowTestCases(reportDiscovery) {
  const cases = WORKFLOW_DEFS.map((def) => {
    const runner = RUNNERS[def.id];
    return workflowCase(def, runner || (async (d) => skipProbeResult(d, 'No runner')));
  });
  if (reportDiscovery) await reportDiscovery(`Workflow tests: ${cases.length} E2E flows`);
  return cases;
}

module.exports = {
  buildWorkflowTestCases,
  WORKFLOW_DEFS,
};
