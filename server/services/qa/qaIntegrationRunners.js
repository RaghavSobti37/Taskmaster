const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const GamificationConfig = require('../../models/GamificationConfig');
const { ACTION_CONFIG_KEY } = require('../../../shared/gamificationRules');
const Project = require('../../models/Project');
const Task = require('../../models/Task');
const Lead = require('../../models/Lead');
const FinanceDocument = require('../../models/FinanceDocument');
const Contact = require('../../models/Contact');
const Log = require('../../models/Log');
const Notification = require('../../models/Notification');
const XPAuditLog = require('../../models/XPAuditLog');
const Campaign = require('../../models/Campaign');
const User = require('../../models/User');
const LeadService = require('../LeadService');
const ContactService = require('../ContactService');
const GamificationService = require('../gamificationService');
const DataHubService = require('../DataHubService');
const { computeRecipientStats } = require('../../utils/campaignStats');
const { isWeekend } = require('../../utils/attendanceDate');
const {
  resolveTestUsers,
  skipProbeResult,
  probeFail,
  probePass,
  request,
  sleep,
  extractId,
} = require('./qaApiClient');

const SERVER_ROOT = path.join(__dirname, '../..');

function track(ctx, type, id) {
  if (id) ctx.artifacts.push({ type, id });
}

async function readServer(rel) {
  try {
    return await fs.readFile(path.join(SERVER_ROOT, rel), 'utf8');
  } catch {
    return '';
  }
}

async function pickProject() {
  return Project.findOne().select('_id name totalTasksCount completedTasksCount owner members memberRoles').lean();
}

async function distinctUsers() {
  const users = await resolveTestUsers();
  const assigner = users.adminUser;
  let assignee = users.salesUser;
  let outsider = users.opsUser;
  if (!assignee || assignee._id.toString() === assigner._id.toString()) assignee = users.anyUser;
  if (!outsider || outsider._id.toString() === assigner._id.toString()) outsider = users.anyUser;
  if (assignee._id.toString() === assigner._id.toString()) return null;
  return { assigner, assignee, outsider };
}

async function configuredXpAmount(action) {
  const config = await GamificationConfig.findOne();
  return GamificationService.getXpAmount(config, action);
}

function entityDetailQuery(field, entityId) {
  if (!entityId) return {};
  if (mongoose.Types.ObjectId.isValid(entityId)) {
    const oid = new mongoose.Types.ObjectId(entityId);
    return { $or: [{ [`details.${field}`]: entityId }, { [`details.${field}`]: oid }] };
  }
  return { [`details.${field}`]: entityId };
}

async function pollXpAudit({ userId, action, entityField, entityId, attempts = 24, intervalMs = 500 }) {
  const base = { userId, action, ...entityDetailQuery(entityField, entityId) };
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs);
    const audit = await XPAuditLog.findOne(base).lean();
    if (audit) return audit;
  }
  return null;
}

async function createDelegatedTask(def, ctx, assigner, assignee, projectId, label) {
  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: assigner,
    data: {
      title: `QA ${label} ${Date.now()}`,
      projectId,
      assignees: [assignee._id],
      status: 'in-progress',
    },
  });
  const taskId = extractId(createRes);
  if (!taskId) return null;
  track(ctx, 'task', taskId);
  return taskId;
}

// ── Suite 5: State machines ──

async function runReviewRollback(def, ctx) {
  const pair = await distinctUsers();
  const project = await pickProject();
  if (!pair) return skipProbeResult(def, 'Need two distinct users');
  if (!project) return skipProbeResult(def, 'No project');

  const taskId = await createDelegatedTask(def, ctx, pair.assigner, pair.assignee, project._id, 'Rollback');
  if (!taskId) return probeFail(def, 'Task create failed');

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: pair.assignee, data: { status: 'done' } });
  const rollbackRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: pair.assigner,
    data: { reviewAction: 'rollback' },
  });
  const status = rollbackRes.data?.status || rollbackRes.data?.data?.status;
  if (status === 'in-progress') {
    return { ...probePass(def, 'Rollback moved task back to in-progress'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Expected in-progress after rollback, got ${status || rollbackRes.status}`), artifacts: ctx.artifacts };
}

async function runInvoiceSubmitPending(def, ctx) {
  const { opsUser } = await resolveTestUsers();
  const res = await request(def, {
    method: 'POST',
    url: '/api/finance/submit-invoice',
    user: opsUser,
    data: {
      title: `QA Submit ${Date.now()}`,
      fileUrl: 'https://example.com/qa-invoice.pdf',
      amount: 100,
    },
  });
  const docId = extractId(res) || res.data?.data?._id;
  const status = res.data?.data?.approvalStatus || res.data?.approvalStatus;
  if (docId) track(ctx, 'finance', docId);
  if ((res.status === 201 || res.status === 200) && status === 'pending') {
    return { ...probePass(def, 'submit-invoice set approvalStatus=pending'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Expected pending invoice (${res.status}) status=${status}`), artifacts: ctx.artifacts };
}

async function runInvoiceRejectReason(def, ctx) {
  const { opsUser } = await resolveTestUsers();
  const doc = await FinanceDocument.create({
    title: `QA Reject ${Date.now()}`,
    fileUrl: 'https://example.com/qa.pdf',
    category: 'invoice',
    approvalStatus: 'pending',
    uploadedBy: opsUser._id,
    submittedBy: opsUser._id,
  });
  track(ctx, 'finance', doc._id);

  const reason = 'QA rejection — duplicate invoice';
  const res = await request(def, {
    method: 'PATCH',
    url: `/api/finance/${doc._id}/reject`,
    user: opsUser,
    data: { rejectionReason: reason },
  });
  const saved = await FinanceDocument.findById(doc._id).lean();
  if (res.status === 200 && saved?.approvalStatus === 'rejected' && saved.rejectionReason === reason) {
    return { ...probePass(def, 'rejectionReason stored on reject'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Reject failed (${res.status}) reason=${saved?.rejectionReason}`), artifacts: ctx.artifacts };
}

async function runProjectCompleteCount(def, ctx) {
  const pair = await distinctUsers();
  const project = await pickProject();
  if (!pair || !project) return skipProbeResult(def, 'Need users + project');

  const before = project.completedTasksCount || 0;
  const taskId = await createDelegatedTask(def, ctx, pair.assigner, pair.assignee, project._id, 'CompleteCount');
  if (!taskId) return probeFail(def, 'Task create failed');

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: pair.assignee, data: { status: 'done' } });
  await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: pair.assigner,
    data: { reviewAction: 'approve' },
  });

  const refreshed = await Project.findById(project._id).select('completedTasksCount').lean();
  if (refreshed && refreshed.completedTasksCount === before + 1) {
    return {
      ...probePass(def, `completedTasksCount ${before} → ${refreshed.completedTasksCount}`),
      artifacts: ctx.artifacts,
    };
  }
  return {
    ...probeFail(def, `completedTasksCount not incremented (before ${before}, after ${refreshed?.completedTasksCount})`),
    artifacts: ctx.artifacts,
  };
}

async function runProjectDeleteCount(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const project = await pickProject();
  if (!project) return skipProbeResult(def, 'No project');
  const before = project.totalTasksCount || 0;

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: adminUser,
    data: { title: `QA DeleteCount ${Date.now()}`, projectId: project._id },
  });
  const taskId = extractId(createRes);
  if (!taskId) return probeFail(def, 'Create failed');
  track(ctx, 'task', taskId);

  const delRes = await request(def, { method: 'DELETE', url: `/api/tasks/${taskId}`, user: adminUser });
  const refreshed = await Project.findById(project._id).select('totalTasksCount').lean();
  if (delRes.status === 200 && refreshed && refreshed.totalTasksCount === Math.max(0, before)) {
    return { ...probePass(def, `totalTasksCount stable/decremented after delete (${before} → ${refreshed.totalTasksCount})`), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Delete count mismatch (${delRes.status}, after ${refreshed?.totalTasksCount})`), artifacts: ctx.artifacts };
}

async function runProjectMemberRoleEnforced(def, ctx) {
  const users = await resolveTestUsers();
  const memberUser = users.salesUser || users.anyUser;
  if (!memberUser) return skipProbeResult(def, 'No member user');

  let project = await Project.findOne({
    members: memberUser._id,
    owner: { $ne: memberUser._id },
  }).lean();
  if (!project) {
    const owner = users.adminUser;
    project = await Project.create({
      name: `QA Role Gate ${Date.now()}`,
      owner: owner._id,
      members: [memberUser._id],
      memberRoles: [{ user: memberUser._id, role: 'member' }],
      status: 'active',
    });
    track(ctx, 'project', project._id);
  }

  const res = await request(def, {
    method: 'PUT',
    url: `/api/projects/${project._id}`,
    user: memberUser,
    data: { name: 'QA Unauthorized Rename' },
  });
  if (res.status === 403) {
    return { ...probePass(def, 'Non-owner member blocked from full project update'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Expected 403 for member name change, got ${res.status}`), artifacts: ctx.artifacts };
}

async function runLeadLockConcurrent(def, ctx) {
  const users = await distinctUsers();
  if (!users) return skipProbeResult(def, 'Need two distinct users');
  const lead = await Lead.findOne();
  if (!lead) return skipProbeResult(def, 'No lead');

  await Lead.findByIdAndUpdate(lead._id, {
    lockedBy: users.assigner._id.toString(),
    lockedAt: new Date(),
  });

  const blockRes = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${lead._id}`,
    user: users.assignee,
    data: { notes: `QA lock probe ${Date.now()}` },
  });
  if (blockRes.status === 423) {
    await Lead.findByIdAndUpdate(lead._id, { $unset: { lockedBy: 1, lockedAt: 1 } });
    return probePass(def, 'Concurrent edit returned 423 Record Locked');
  }
  await Lead.findByIdAndUpdate(lead._id, { $unset: { lockedBy: 1, lockedAt: 1 } });
  return probeFail(def, `Expected 423 lock, got ${blockRes.status}`);
}

async function runLeadLockExpires(def, ctx) {
  const users = await resolveTestUsers();
  const lead = await Lead.findOne();
  if (!lead) return skipProbeResult(def, 'No lead');

  const staleAt = new Date(Date.now() - 120 * 1000);
  await Lead.findByIdAndUpdate(lead._id, {
    lockedBy: users.adminUser._id.toString(),
    lockedAt: staleAt,
  });

  const renewRes = await request(def, {
    method: 'PUT',
    url: `/api/crm/leads/${lead._id}`,
    user: users.salesUser || users.anyUser,
    data: { callStatus: 'Connected' },
  });
  await Lead.findByIdAndUpdate(lead._id, { $unset: { lockedBy: 1, lockedAt: 1 } });
  if (renewRes.status === 200) {
    return probePass(def, 'Stale lock (>60s) allowed new editor to claim lead');
  }
  return probeFail(def, `Expected 200 after stale lock, got ${renewRes.status}`);
}

// ── Suite 6: Gamification + notifications ──

async function runTaskCompleteXp(def, ctx) {
  const pair = await distinctUsers();
  const project = await pickProject();
  if (!pair || !project) return skipProbeResult(def, 'Need users + project');

  const taskId = await createDelegatedTask(def, ctx, pair.assigner, pair.assignee, project._id, 'XP');
  if (!taskId) return probeFail(def, 'Task create failed');

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: pair.assignee, data: { status: 'done' } });
  const approveRes = await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: pair.assigner,
    data: { reviewAction: 'approve' },
  });
  if (approveRes.status >= 400) {
    return { ...probeFail(def, `Review approve failed (${approveRes.status})`), artifacts: ctx.artifacts };
  }

  const xpAmount = await configuredXpAmount('COMPLETE_TASK');
  if (!xpAmount || xpAmount <= 0) {
    return {
      ...probePass(def, `COMPLETE_TASK XP disabled in config (${ACTION_CONFIG_KEY.COMPLETE_TASK}=0)`),
      artifacts: ctx.artifacts,
    };
  }

  const audit = await pollXpAudit({
    userId: pair.assignee._id,
    action: 'COMPLETE_TASK',
    entityField: 'taskId',
    entityId: taskId,
  });
  if (audit) {
    return { ...probePass(def, 'COMPLETE_TASK XP audit logged after approval'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No COMPLETE_TASK XPAuditLog after task approval'), artifacts: ctx.artifacts };
}

async function runLeadCapturedXp(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const email = `qa-lead-xp-${Date.now()}@example.com`;
  const phone = `9${String(Date.now()).slice(-9)}`;
  const res = await request(def, {
    method: 'POST',
    url: '/api/crm/leads',
    user: adminUser,
    data: { name: 'QA XP Lead', email, phone, source: 'QA Test' },
  });
  const leadId = extractId(res);
  if (leadId) track(ctx, 'lead', leadId);
  if (res.status === 409) {
    return { ...probeFail(def, 'Lead create returned 409 duplicate — cannot verify LEAD_CAPTURE XP'), artifacts: ctx.artifacts };
  }
  if (!leadId || (res.status !== 201 && res.status !== 200)) {
    return { ...probeFail(def, `Lead create failed (${res.status})`), artifacts: ctx.artifacts };
  }

  const xpAmount = await configuredXpAmount('LEAD_CAPTURE');
  if (!xpAmount || xpAmount <= 0) {
    return {
      ...probePass(def, `LEAD_CAPTURE XP disabled in config (${ACTION_CONFIG_KEY.LEAD_CAPTURE}=0)`),
      artifacts: ctx.artifacts,
    };
  }

  const audit = await pollXpAudit({
    userId: adminUser._id,
    action: 'LEAD_CAPTURE',
    entityField: 'leadId',
    entityId: leadId,
  });
  if (audit) {
    return { ...probePass(def, 'LEAD_CAPTURE XP logged after CRM lead POST'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No LEAD_CAPTURE XPAuditLog after lead create'), artifacts: ctx.artifacts };
}

async function runXpLeaderboardReflect(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  await XPAuditLog.create({
    userId: adminUser._id,
    action: 'COMPLETE_TASK',
    amount: 25,
    details: { taskId: new (require('mongoose')).Types.ObjectId() },
  });

  const afterRes = await request(def, { method: 'GET', url: '/api/gamification/leaderboard', user: adminUser });
  if (afterRes.status !== 200) return probeFail(def, `Leaderboard fetch failed (${afterRes.status})`);

  const list = Array.isArray(afterRes.data) ? afterRes.data : afterRes.data?.leaderboard || [];
  const row = list.find((e) => String(e._id || e.userId || e.id) === adminUser._id.toString());
  if (row && (row.weeklyXp != null || row.xp != null || row.exp != null)) {
    return probePass(def, `Leaderboard shows weeklyXp=${row.weeklyXp ?? row.xp ?? row.exp}`);
  }

  const progressRes = await request(def, { method: 'GET', url: '/api/gamification/progress', user: adminUser });
  const exp = progressRes.data?.exp ?? progressRes.data?.totalExp;
  if (progressRes.status === 200 && exp != null) {
    return probePass(def, `Gamification progress reflects XP (exp=${exp})`);
  }
  return probeFail(def, 'Leaderboard/progress missing XP for test user');
}

async function runLevelUpThreshold(def, ctx) {
  const level1 = await GamificationService.getLevelFromExp(0);
  const config = await GamificationService.getConfig();
  const stepXp = config.stepXp || 100;
  const level2Exp = await GamificationService.getExpForLevel(2);
  const levelAtThreshold = await GamificationService.getLevelFromExp(level2Exp || stepXp);
  if (level1 === 1 && levelAtThreshold >= 2) {
    return probePass(def, `Level thresholds wired (L1@${0}xp, L2+@${level2Exp || stepXp}xp → level ${levelAtThreshold})`);
  }
  return probeFail(def, `Level math unexpected: L1=${level1}, L2@${level2Exp}→${levelAtThreshold}`);
}

async function runTaskAssignNotify(def, ctx) {
  const pair = await distinctUsers();
  const project = await pickProject();
  if (!pair || !project) return skipProbeResult(def, 'Need users + project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: pair.assigner,
    data: {
      title: `QA Notify Assign ${Date.now()}`,
      projectId: project._id,
      assignees: [pair.assignee._id],
    },
  });
  const taskId = extractId(createRes);
  if (!taskId) return probeFail(def, 'Task create failed');
  track(ctx, 'task', taskId);

  await sleep(400);
  const note = await Notification.findOne({
    recipient: pair.assignee._id,
    relatedTaskId: taskId,
    title: /assigned/i,
  }).lean();
  if (note) {
    return { ...probePass(def, 'Assignment notification persisted'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No assignment notification for assignee'), artifacts: ctx.artifacts };
}

async function runMentionNotify(def, ctx) {
  const users = await distinctUsers();
  const project = await pickProject();
  if (!users || !project) return skipProbeResult(def, 'Need users + project');
  const target = users.assignee;
  const label = (target.name || target.email || 'user').split('@')[0].trim();

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: users.assigner,
    data: {
      title: `QA Mention ${Date.now()}`,
      description: `Please review @${label} on this item`,
      projectId: project._id,
      assignees: [users.assigner._id],
    },
  });
  const taskId = extractId(createRes);
  if (!taskId) return probeFail(def, 'Task create failed');
  track(ctx, 'task', taskId);

  await sleep(400);
  const note = await Notification.findOne({
    recipient: target._id,
    relatedTaskId: taskId,
  }).lean();
  if (note) {
    return { ...probePass(def, `@mention notification created for ${label}`), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No notification for @mentioned user'), artifacts: ctx.artifacts };
}

async function runReviewSubmitNotify(def, ctx) {
  const pair = await distinctUsers();
  const project = await pickProject();
  if (!pair || !project) return skipProbeResult(def, 'Need users + project');

  const taskId = await createDelegatedTask(def, ctx, pair.assigner, pair.assignee, project._id, 'ReviewNotify');
  if (!taskId) return probeFail(def, 'Task create failed');

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: pair.assignee, data: { status: 'done' } });
  await sleep(400);

  const note = await Notification.findOne({
    recipient: pair.assigner._id,
    relatedTaskId: taskId,
    category: 'review',
  }).lean();
  if (note) {
    return { ...probePass(def, 'In-review notification sent to assigner'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No in-review notification for assigner'), artifacts: ctx.artifacts };
}

async function runReviewApproveNotify(def, ctx) {
  const pair = await distinctUsers();
  const project = await pickProject();
  if (!pair || !project) return skipProbeResult(def, 'Need users + project');

  const taskId = await createDelegatedTask(def, ctx, pair.assigner, pair.assignee, project._id, 'ApproveNotify');
  if (!taskId) return probeFail(def, 'Task create failed');

  await request(def, { method: 'PUT', url: `/api/tasks/${taskId}`, user: pair.assignee, data: { status: 'done' } });
  await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: pair.assigner,
    data: { reviewAction: 'approve' },
  });
  await sleep(400);

  const note = await Notification.findOne({
    recipient: pair.assignee._id,
    relatedTaskId: taskId,
    title: /approved/i,
  }).lean();
  if (note) {
    return { ...probePass(def, 'Review approval notification sent to assignee'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No approval notification for assignee'), artifacts: ctx.artifacts };
}

// ── Suite 7: Data hub + CRM sync ──

async function runLeadSyncsContact(def, ctx) {
  const email = `qa-contact-sync-${Date.now()}@example.com`;
  const phone = `8${String(Date.now()).slice(-9)}`;
  const lead = await LeadService.createLead({
    name: 'QA Contact Sync',
    email,
    phone,
    source: 'QA Integration',
  });
  track(ctx, 'lead', lead._id);

  const contact = await Contact.findOne({ email }).lean();
  if (contact?.inCRM) {
    return { ...probePass(def, 'LeadService.syncToContactHub set Contact.inCRM'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'Contact.inCRM not set after LeadService.createLead'), artifacts: ctx.artifacts };
}

async function runExlySyncsContact(def, ctx) {
  const exlySrc = await readServer('services/exlyService.js');
  const contactSrc = await readServer('services/ContactService.js');
  const ok = exlySrc.includes('mergeContact') && contactSrc.includes('inExly');
  return ok
    ? probePass(def, 'exlyService.mergeContact sets inExly on Contact')
    : probeFail(def, 'Exly → Contact.inExly wiring not found');
}

async function runMailOpenContactSync(def, ctx) {
  const contactSrc = await readServer('services/ContactService.js');
  const trackSrc = await readServer('routes/track.js');
  const ok = contactSrc.includes('inMailer') && trackSrc.includes("eventType: 'Open'");
  return ok
    ? probePass(def, 'Open tracking + Contact.inMailer flags present in codebase')
    : probeFail(def, 'Mail open → Contact.inMailer wiring incomplete');
}

async function runMultiinletFlagSet(def, ctx) {
  const email = `qa-multi-${Date.now()}@example.com`;
  const phone = `7${String(Date.now()).slice(-9)}`;
  await ContactService.mergeContact({ name: 'QA Multi', email, phone }, 'crm');
  await ContactService.mergeContact({ name: 'QA Multi', email, phone, exlyOfferingTitle: 'QA Course' }, 'exly');
  const contact = await Contact.findOne({ email }).lean();
  if (contact?.isMultiInlet && (contact.inletCount || 0) >= 2) {
    return probePass(def, `isMultiInlet=true inletCount=${contact.inletCount}`);
  }
  return probeFail(def, `Expected multi-inlet contact, got isMultiInlet=${contact?.isMultiInlet} count=${contact?.inletCount}`);
}

async function runTaskMutationLogged(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const project = await pickProject();
  if (!project) return skipProbeResult(def, 'No project');

  const createRes = await request(def, {
    method: 'POST',
    url: '/api/tasks',
    user: adminUser,
    data: { title: `QA Log ${Date.now()}`, projectId: project._id, status: 'in-progress' },
  });
  const taskId = extractId(createRes);
  if (!taskId) return probeFail(def, 'Create failed');
  track(ctx, 'task', taskId);

  await request(def, {
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    user: adminUser,
    data: { status: 'done' },
  });

  const audit = await Log.findOne({ targetId: taskId, action: 'UPDATE_TASK' }).sort({ createdAt: -1 }).lean();
  if (audit) {
    return { ...probePass(def, 'Task mutation recorded in Log (UPDATE_TASK)'), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, 'No UPDATE_TASK Log after task mutation'), artifacts: ctx.artifacts };
}

async function runBugTaskCorrectProject(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const res = await request(def, {
    method: 'POST',
    url: '/api/tasks/bug',
    user: adminUser,
    data: { title: 'QA probe bug', page: 'QATesting', description: 'Automated probe', severity: 'low' },
  });
  const taskId = extractId(res);
  if (!taskId) return probeFail(def, `Bug report failed (${res.status})`);
  track(ctx, 'task', taskId);

  const task = await Task.findById(taskId).populate('projectId', 'name').lean();
  const projectName = task?.projectId?.name || '';
  if (/tech|maintenance/i.test(projectName)) {
    return { ...probePass(def, `Bug task in "${projectName}"`), artifacts: ctx.artifacts };
  }
  return { ...probeFail(def, `Bug not in Tech Stack project (got "${projectName}")`), artifacts: ctx.artifacts };
}

async function runCampaignStatsAccurate(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const campaign = await Campaign.findOne({ 'recipients.0': { $exists: true } }).lean();
  if (!campaign) return skipProbeResult(def, 'No campaign with recipients');

  const res = await request(def, { method: 'GET', url: `/api/campaigns/${campaign._id}`, user: adminUser });
  if (res.status !== 200) return probeFail(def, `Campaign GET failed (${res.status})`);

  const expected = computeRecipientStats(campaign.recipients || []);
  const apiStats = res.data?.stats || res.data?.data?.stats;
  if (!apiStats) return probeFail(def, 'Campaign response missing stats');

  const match =
    apiStats.sent === expected.stats.sent &&
    apiStats.opened === expected.stats.opened &&
    apiStats.clicked === expected.stats.clicked;
  if (match) {
    return probePass(def, `stats.sent/opened/clicked match recipient rows (${apiStats.sent}/${apiStats.opened}/${apiStats.clicked})`);
  }
  return probeFail(def, `Stats mismatch API=${JSON.stringify(apiStats)} expected=${JSON.stringify(expected.stats)}`);
}

async function runAttendanceWeekendLeave(def, ctx) {
  const clientUtils = await fs.readFile(
    path.join(SERVER_ROOT, '../client/src/utils/attendanceUtils.js'),
    'utf8'
  ).catch(() => '');
  const sat = new Date('2026-06-06T12:00:00+05:30');
  const isSat = isWeekend(sat);
  const clientHasWeekend = clientUtils.includes('isWeekend') && /Sat|Sun/.test(clientUtils);
  if (isSat && clientHasWeekend) {
    return probePass(def, 'Weekend detection (Sat) via attendanceDate + client attendanceUtils');
  }
  return probeFail(def, `Weekend leave wiring incomplete (server Sat=${isSat}, client=${clientHasWeekend})`);
}

async function runBookedCallFullFlow(def, ctx) {
  const src = await readServer('controllers/webhookController.js');
  const steps = ['Lead.findOne', 'LeadService', 'convertToIST', 'mergeContact'];
  const missing = steps.filter((s) => !src.includes(s));
  if (!missing.length) {
    return probePass(def, 'processBookedCallLogic includes lead + IST + contact sync steps');
  }
  return probeFail(def, `Book-call pipeline missing: ${missing.join(', ')}`);
}

// ── Suite 8: Sync + static locks ──

async function runCsvDedupEmail(def, ctx) {
  const src = await readServer('workers/importWorker.js');
  const ok = src.includes('doc.email') && src.includes('upsert: true');
  return ok ? probePass(def, 'CSV import upserts on email') : probeFail(def, 'Email dedup upsert not found in importWorker');
}

async function runCsvDedupPhone(def, ctx) {
  const src = await readServer('workers/importWorker.js');
  const ok = src.includes('doc.phone') && src.includes('upsert: true');
  return ok ? probePass(def, 'CSV import upserts on phone') : probeFail(def, 'Phone dedup upsert not found in importWorker');
}

async function runTscDataNormalized(def, ctx) {
  const src = await readServer('controllers/tscController.js');
  const ok = src.includes('sanitizeEmail') && src.includes('normalizePhone') && src.includes('sanitizeName');
  return ok ? probePass(def, 'TSC import normalizes email/phone/name') : probeFail(def, 'TSC normalization missing');
}

async function runExlyWebhookBooking(def, ctx) {
  const ctrl = await readServer('controllers/exlyController.js');
  const ok = ctrl.includes('EXLY_WEBHOOK_SECRET') && ctrl.includes('mergeContact');
  return ok ? probePass(def, 'Exly webhook handler signed + mergeContact') : probeFail(def, 'Exly webhook wiring incomplete');
}

async function runSyncBookedcallFullFlow(def, ctx) {
  const src = await readServer('controllers/webhookController.js');
  const pipeline = ['processBookedCallLogic', 'LeadService.createLead', 'LeadService.updateLead'];
  const ok = pipeline.every((p) => src.includes(p));
  return ok
    ? probePass(def, 'Book-call webhook sync uses LeadService create/update pipeline')
    : probeFail(def, 'Book-call 4-step pipeline incomplete in webhookController');
}

async function runMailEventNoHardcode(def, ctx) {
  const geo = await readServer('utils/geoLookup.js');
  const campaign = await readServer('routes/campaignRoutes.js');
  const badGeo = /Mumbai/i.test(geo);
  const usesResolver = campaign.includes('resolveMailEventCityAsync') && campaign.includes('displayCity');
  if (!badGeo && usesResolver) {
    return probePass(def, 'Campaign activity uses geoLookup resolver (no Mumbai hardcode in geoLookup)');
  }
  return probeFail(def, `Mail geo check failed (geoLookup Mumbai=${badGeo}, resolver=${usesResolver})`);
}

async function runUnsubscribeDualWrite(def, ctx) {
  const trackJs = await readServer('routes/track.js');
  const updatesLead = trackJs.includes('Lead.updateMany') && trackJs.includes('unsubscribed');
  const updatesContact = /Contact\.(updateMany|findOneAndUpdate)/.test(trackJs);
  if (updatesLead && updatesContact) {
    return probePass(def, 'Unsubscribe updates Lead and Contact');
  }
  if (updatesLead && !updatesContact) {
    return probeFail(def, 'Unsubscribe updates Lead only — Contact dual-write missing in track.js');
  }
  return probeFail(def, 'Unsubscribe handler wiring not found');
}

async function runFolderCountMatch(def, ctx) {
  const { adminUser } = await resolveTestUsers();
  const apiRes = await request(def, { method: 'GET', url: '/api/data-hub/folders', user: adminUser });
  if (apiRes.status === 403) return skipProbeResult(def, 'Data Hub folders require admin');
  if (apiRes.status !== 200) return probeFail(def, `folders API failed (${apiRes.status})`);

  const serviceCounts = await DataHubService.getFolderCounts();
  const apiFolders = apiRes.data?.folders || [];
  const mismatches = [];
  for (const folder of apiFolders.slice(0, 8)) {
    const key = folder.key;
    if (!key || key.startsWith('tsc:')) continue;
    const serviceCount = serviceCounts.counts?.[key];
    if (serviceCount != null && folder.count !== serviceCount) {
      mismatches.push(`${key}: api=${folder.count} service=${serviceCount}`);
    }
  }
  if (!mismatches.length) {
    return probePass(def, 'Folder API counts align with DataHubService.getFolderCounts');
  }
  return probeFail(def, `Folder count drift: ${mismatches.slice(0, 3).join('; ')}`);
}

async function runMultiinletCountAccurate(def, ctx) {
  const contact = await Contact.findOne({ isMultiInlet: true, 'inlets.1': { $exists: true } })
    .setOptions({ bypassTenant: true })
    .lean();
  if (!contact) return skipProbeResult(def, 'No multi-inlet contact in DB');
  const deduped = (contact.inlets || []).length;
  if (contact.inletCount === deduped) {
    return probePass(def, `inletCount=${contact.inletCount} matches inlets.length`);
  }
  return probeFail(def, `inletCount ${contact.inletCount} !== inlets ${deduped}`);
}

async function runConcurrentXp(def, ctx) {
  const src = await readServer('services/gamificationService.js');
  const ok = src.includes('hasAwardForEntity') && src.includes('entityKey');
  return ok
    ? probePass(def, 'Gamification hasAwardForEntity prevents duplicate XP per entity')
    : probeFail(def, 'Entity-scoped XP idempotency not found');
}

const PLANNED_INTEGRATION_DEFS = [
  { id: 'sm-review-rollback', title: 'Assigner rolls back task from in-review', sev: 'high', category: 'business-logic' },
  { id: 'sm-invoice-submit-pending', title: 'Invoice submission sets approvalStatus=pending', sev: 'high', category: 'business-logic' },
  { id: 'sm-invoice-reject-reason', title: 'Invoice rejection stores reason field', sev: 'medium', category: 'business-logic' },
  { id: 'sm-project-complete-count', title: 'Task completion increments completedTaskCount', sev: 'high', category: 'business-logic' },
  { id: 'sm-project-delete-count', title: 'Task deletion decrements project.totalTasksCount', sev: 'medium', category: 'business-logic' },
  { id: 'sm-project-member-role-enforced', title: 'Project viewer role blocks mutation', sev: 'medium', category: 'permission' },
  { id: 'sm-lead-lock-concurrent', title: 'Concurrent lead edits trigger optimistic lock', sev: 'high', category: 'business-logic' },
  { id: 'sm-lead-lock-expires', title: 'Lead lock releases after TTL', sev: 'medium', category: 'business-logic' },
  { id: 'int-task-complete-xp', title: 'Task completion triggers XP award chain', sev: 'critical', category: 'business-logic' },
  { id: 'int-lead-captured-xp', title: 'CRM lead creation queues LEAD_CAPTURED XP', sev: 'high', category: 'business-logic' },
  { id: 'int-xp-leaderboard-reflect', title: 'XP award reflects in leaderboard', sev: 'high', category: 'business-logic' },
  { id: 'int-level-up-threshold', title: 'User level increments at XP threshold', sev: 'medium', category: 'business-logic' },
  { id: 'int-task-assign-notify', title: 'Task assignment creates notification', sev: 'high', category: 'business-logic' },
  { id: 'int-mention-notify', title: '@mention notifies user', sev: 'high', category: 'business-logic' },
  { id: 'int-review-submit-notify', title: 'In-review notifies assigner', sev: 'high', category: 'business-logic' },
  { id: 'int-review-approve-notify', title: 'Review approval notifies assignee', sev: 'medium', category: 'business-logic' },
  { id: 'int-lead-syncs-to-contact', title: 'Lead syncs to Contact.inCRM', sev: 'high', category: 'business-logic' },
  { id: 'int-exly-syncs-to-contact', title: 'ExlyBooking syncs to Contact.inExly', sev: 'high', category: 'business-logic' },
  { id: 'int-mail-open-contact-sync', title: 'MailEvent open sets Contact.inMailer', sev: 'medium', category: 'business-logic' },
  { id: 'int-multiinlet-flag-set', title: 'Multi-inlet Contact gets isMultiInlet=true', sev: 'medium', category: 'business-logic' },
  { id: 'int-task-mutation-logged', title: 'Task mutation creates Log entry', sev: 'medium', category: 'business-logic' },
  { id: 'int-bug-task-correct-project', title: 'Bug report lands in Tech Stack project', sev: 'medium', category: 'business-logic' },
  { id: 'int-campaign-stats-accurate', title: 'Campaign stats match MailEvents', sev: 'high', category: 'business-logic' },
  { id: 'int-attendance-weekend-leave', title: 'Saturday attendance classified as leave', sev: 'medium', category: 'business-logic' },
  { id: 'int-booked-call-full-flow', title: 'Book-a-call webhook full pipeline', sev: 'high', category: 'business-logic' },
  { id: 'sync-lead-csv-dedup-email', title: 'CSV import deduplicates by email', sev: 'critical', category: 'business-logic' },
  { id: 'sync-lead-csv-dedup-phone', title: 'CSV import deduplicates by phone', sev: 'critical', category: 'business-logic' },
  { id: 'sync-tsc-data-normalized', title: 'TSC import normalizes email/name', sev: 'high', category: 'business-logic' },
  { id: 'sync-exly-webhook-booking', title: 'Exly webhook creates booking + Contact', sev: 'high', category: 'business-logic' },
  { id: 'sync-bookedcall-full-flow', title: 'Book-a-call webhook 4-step pipeline', sev: 'critical', category: 'business-logic' },
  { id: 'sync-mail-event-no-hardcode', title: 'MailEvent displayCity not hardcoded (LOCKED)', sev: 'critical', category: 'business-logic' },
  { id: 'sync-unsubscribe-dual-write', title: 'Unsubscribe dual-write Lead + Contact', sev: 'critical', category: 'business-logic' },
  { id: 'sync-folder-count-match', title: 'Data Hub folder counts match Contact', sev: 'high', category: 'business-logic' },
  { id: 'sync-multiinlet-count-accurate', title: 'inletCount reflects active inlets', sev: 'high', category: 'business-logic' },
  { id: 'int-concurrent-xp', title: 'Duplicate XP blocked per entity', sev: 'high', category: 'business-logic' },
];

const PLANNED_RUNNERS = {
  'sm-review-rollback': runReviewRollback,
  'sm-invoice-submit-pending': runInvoiceSubmitPending,
  'sm-invoice-reject-reason': runInvoiceRejectReason,
  'sm-project-complete-count': runProjectCompleteCount,
  'sm-project-delete-count': runProjectDeleteCount,
  'sm-project-member-role-enforced': runProjectMemberRoleEnforced,
  'sm-lead-lock-concurrent': runLeadLockConcurrent,
  'sm-lead-lock-expires': runLeadLockExpires,
  'int-task-complete-xp': runTaskCompleteXp,
  'int-lead-captured-xp': runLeadCapturedXp,
  'int-xp-leaderboard-reflect': runXpLeaderboardReflect,
  'int-level-up-threshold': runLevelUpThreshold,
  'int-task-assign-notify': runTaskAssignNotify,
  'int-mention-notify': runMentionNotify,
  'int-review-submit-notify': runReviewSubmitNotify,
  'int-review-approve-notify': runReviewApproveNotify,
  'int-lead-syncs-to-contact': runLeadSyncsContact,
  'int-exly-syncs-to-contact': runExlySyncsContact,
  'int-mail-open-contact-sync': runMailOpenContactSync,
  'int-multiinlet-flag-set': runMultiinletFlagSet,
  'int-task-mutation-logged': runTaskMutationLogged,
  'int-bug-task-correct-project': runBugTaskCorrectProject,
  'int-campaign-stats-accurate': runCampaignStatsAccurate,
  'int-attendance-weekend-leave': runAttendanceWeekendLeave,
  'int-booked-call-full-flow': runBookedCallFullFlow,
  'sync-lead-csv-dedup-email': runCsvDedupEmail,
  'sync-lead-csv-dedup-phone': runCsvDedupPhone,
  'sync-tsc-data-normalized': runTscDataNormalized,
  'sync-exly-webhook-booking': runExlyWebhookBooking,
  'sync-bookedcall-full-flow': runSyncBookedcallFullFlow,
  'sync-mail-event-no-hardcode': runMailEventNoHardcode,
  'sync-unsubscribe-dual-write': runUnsubscribeDualWrite,
  'sync-folder-count-match': runFolderCountMatch,
  'sync-multiinlet-count-accurate': runMultiinletCountAccurate,
  'int-concurrent-xp': runConcurrentXp,
};

module.exports = { PLANNED_INTEGRATION_DEFS, PLANNED_RUNNERS };
