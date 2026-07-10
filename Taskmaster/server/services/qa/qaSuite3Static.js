const path = require('path');
const { makeCheck, readTextResolved, readRepoText, listFiles, SERVER_ROOT, REPO_ROOT } = require('./qaCheckUtils');
const { ROUTE_ALLOWLIST: BYPASS_ROUTE_ALLOWLIST } = require('../../infrastructure/database/bypassTenantPolicy');

/**
 * Suite 3 — 20 extended static checks (code/config analysis).
 */
async function runSuite3StaticChecks() {
  const checks = [];
  const leadModel = await readTextResolved('models/Lead.js');
  const contactModel = await readTextResolved('models/PersonIndex.js');
  const taskModel = await readTextResolved('models/Task.js');
  const clientDate = await readRepoText('client/src/utils/dateValidation.js');
  const crmWriteSvc = await readTextResolved('domains/crm/services/leadWriteService.js');
  const taskSvc = await readTextResolved('services/TaskService.js');
  const announcementRoutes = await readTextResolved('routes/announcementRoutes.js');
  const uploadthing = await readTextResolved('config/uploadthing.js');
  const taskAssignment = await readTextResolved('models/TaskAssignment.js');
  const projectModel = await readTextResolved('models/Project.js');
  const xpAudit = await readTextResolved('models/XPAuditLog.js');
  const notifDisp = await readTextResolved('services/notificationDispatcher.js');
  const bgQueue = await readTextResolved('services/backgroundQueue.js');
  const crmSnapshot = await readTextResolved('models/CRMStatSnapshot.js');
  const financeRoutes = await readTextResolved('routes/financeRoutes.js');
  const dataHubRoutes = await readTextResolved('routes/dataHubRoutes.js');
  const dataHubSvc = await readTextResolved('services/DataHubService.js');
  const artistPathHubSvc = await readTextResolved('services/artistPathHubService.js');
  const attendanceModel = await readTextResolved('models/Attendance.js');
  const mailTemplateModel = await readTextResolved('domains/mail/models/MailTemplate.js');
  const shortcutPref = await readTextResolved('models/ShortcutPreference.js');
  const workspacePref = await readTextResolved('models/WorkspacePreference.js');
  const crmStatsSvc = await readTextResolved('domains/crm/services/crmStatsService.js');
  const mailEventQuerySvc = await readTextResolved('domains/mail/services/mailEventQueryService.js');
  const statsWorker = await readTextResolved('workers/statsWorker.js');

  checks.push(
    makeCheck(
      'val-lead-phone-unique',
      'database-indexes',
      'Lead phone unique per tenant',
      leadModel && /tenantId:\s*1,\s*phone:\s*1.*unique:\s*true/s.test(leadModel) ? 'pass' : 'fail',
      'Compound unique index on { tenantId, phone }',
      'models/Lead.js',
      'high'
    ),
    makeCheck(
      'val-lead-email-unique',
      'database-indexes',
      'Lead email unique per tenant',
      leadModel && /tenantId:\s*1,\s*email:\s*1.*unique:\s*true/s.test(leadModel) ? 'pass' : 'fail',
      'Compound unique sparse index on { tenantId, email }',
      'models/Lead.js',
      'high'
    ),
    makeCheck(
      'val-contact-email-index',
      'database-indexes',
      'Contact dedup index exists',
      contactModel && /\.index\(\{\s*email/.test(contactModel) ? 'pass' : 'fail',
      'Contact schema indexes email for reconcile dedup',
      'models/PersonIndex.js',
      'high'
    ),
    makeCheck(
      'val-task-status-enum',
      'business-logic',
      "Task status enum includes 'in-review'",
      taskModel && taskModel.includes("'in-review'") ? 'pass' : 'fail',
      'Task.status enum must include in-review for review workflow',
      'models/Task.js',
      'critical'
    ),
    makeCheck(
      'val-lead-status-enums',
      'business-logic',
      'Lead status fields have enum validators',
      leadModel && leadModel.includes('emailStatus') && /enum:\s*\[/.test(leadModel) ? 'pass' : 'warn',
      'Lead uses enum on emailStatus; callStatus/leadStatus are string funnel fields',
      'models/Lead.js',
      'medium'
    ),
    makeCheck(
      'val-date-guard-client',
      'input-validation',
      'Client date validation uses shared guard',
      clientDate && (clientDate.includes('dateValidation') || clientDate.includes('assertNotPast') || clientDate.includes('assertDateKey'))
        ? 'pass'
        : 'warn',
      clientDate ? 'client/src/utils/dateValidation.js present' : 'client dateValidation missing',
      'client/src/utils/dateValidation.js',
      'high'
    ),
    makeCheck(
      'san-crm-controller-sanitizes',
      'input-validation',
      'CRM controller calls sanitizer before lead save',
      crmWriteSvc && /sanitizeEmail|sanitizeName|normalizePhone/.test(crmWriteSvc) ? 'pass' : 'fail',
      'leadWriteService uses sanitizer utilities',
      'domains/crm/services/leadWriteService.js',
      'high'
    ),
    makeCheck(
      'san-task-strips-html',
      'input-validation',
      'TaskService sanitizes title/description HTML',
      taskSvc && /sanitize|stripHtml|replace\(/i.test(taskSvc) ? 'pass' : 'warn',
      'TaskService should neutralize HTML in text fields',
      'services/TaskService.js',
      'medium'
    ),
    makeCheck(
      'san-announcement-sanitized',
      'input-validation',
      'Announcement content sanitized before broadcast',
      announcementRoutes && /sanitize|stripHtml|xss|DOMPurify/i.test(announcementRoutes) ? 'pass' : 'warn',
      'Announcement routes should sanitize message HTML before store/email',
      'routes/announcementRoutes.js',
      'medium'
    ),
    makeCheck(
      'san-uploadthing-mimetype',
      'input-validation',
      'Finance uploads enforce MIME type restrictions',
      uploadthing && uploadthing.includes('financeDocUploader') && /pdf|image|maxFileSize/.test(uploadthing)
        ? 'pass'
        : 'fail',
      'UploadThing financeDocUploader whitelists pdf/image/text/blob types',
      'config/uploadthing.js',
      'high'
    ),
    makeCheck(
      'biz-task-assignment-indexed',
      'database-indexes',
      'TaskAssignment has compound unique index',
      taskAssignment && /unique:\s*true/.test(taskAssignment) && /taskId|userId/.test(taskAssignment) ? 'pass' : 'warn',
      'TaskAssignment should prevent duplicate taskId+userId rows',
      'models/TaskAssignment.js',
      'high'
    ),
    makeCheck(
      'biz-project-counter-fields',
      'business-logic',
      'Project schema has task counter fields',
      projectModel && projectModel.includes('totalTasksCount') && projectModel.includes('completedTasksCount')
        ? 'pass'
        : 'fail',
      'Project uses totalTasksCount and completedTasksCount',
      'models/Project.js',
      'high'
    ),
    makeCheck(
      'biz-xp-audit-log-model',
      'business-logic',
      'XPAuditLog model file exists',
      xpAudit && xpAudit.includes('mongoose.model') ? 'pass' : 'fail',
      'XPAuditLog model exported',
      'models/XPAuditLog.js',
      'medium'
    ),
    makeCheck(
      'biz-notification-tri-channel',
      'business-logic',
      'NotificationDispatcher sends via 3 channels',
      notifDisp &&
        /createNotification|Notification\.create/i.test(notifDisp) &&
        (/sendEmail|dispatchEmail|mail/i.test(notifDisp)) &&
        (/push|webPush|sendPush/i.test(notifDisp))
        ? 'pass'
        : 'warn',
      'In-app + email + push paths in notificationDispatcher',
      'services/notificationDispatcher.js',
      'high'
    ),
    makeCheck(
      'biz-gamification-queue-wired',
      'business-logic',
      'backgroundQueue exports queueGamificationEvent',
      bgQueue && bgQueue.includes('queueGamificationEvent') ? 'pass' : 'fail',
      'queueGamificationEvent must be exported',
      'services/backgroundQueue.js',
      'high'
    ),
    makeCheck(
      'biz-crm-stat-snapshot-model',
      'business-logic',
      'CRMStatSnapshot model exists',
      crmSnapshot ? 'pass' : 'fail',
      'CRMStatSnapshot.js present for dashboard aggregates',
      'models/CRMStatSnapshot.js',
      'medium'
    ),
    makeCheck(
      'auth-finance-opsonly-guard',
      'authorization',
      'Finance approve/reject has opsOnly guard',
      financeRoutes && financeRoutes.includes('opsOnly') && /\/:id\/approve/.test(financeRoutes) ? 'pass' : 'fail',
      'financeRoutes applies opsOnly to approve/reject',
      'routes/financeRoutes.js',
      'critical'
    ),
    makeCheck(
      'auth-datahub-admin-guard',
      'authorization',
      'Data Hub routes require admin middleware',
      dataHubRoutes && dataHubRoutes.includes('admin') && dataHubRoutes.includes('protect') ? 'pass' : 'fail',
      'dataHubRoutes uses protect + admin',
      'routes/dataHubRoutes.js',
      'critical'
    ),
    makeCheck(
      'auth-tenant-on-lead',
      'authorization',
      'tenantPlugin applied to Lead model',
      leadModel && leadModel.includes('tenantPlugin') ? 'pass' : 'fail',
      'LeadSchema.plugin(tenantPlugin)',
      'models/Lead.js',
      'critical'
    ),
    makeCheck(
      'auth-tenant-on-attendance',
      'authorization',
      'tenantPlugin applied to Attendance model',
      attendanceModel && attendanceModel.includes('tenantPlugin') ? 'pass' : 'fail',
      'attendanceSchema.plugin(tenantPlugin)',
      'models/Attendance.js',
      'high'
    ),
    makeCheck(
      'auth-tenant-on-mail-template',
      'authorization',
      'tenantPlugin applied to MailTemplate model',
      mailTemplateModel && mailTemplateModel.includes('tenantPlugin') ? 'pass' : 'fail',
      'mailTemplateSchema.plugin(tenantPlugin)',
      'domains/mail/models/MailTemplate.js',
      'high'
    ),
    makeCheck(
      'auth-tenant-on-preferences',
      'authorization',
      'tenantPlugin applied to user preference models',
      shortcutPref?.includes('tenantPlugin')
        && workspacePref?.includes('tenantPlugin')
        ? 'pass'
        : 'fail',
      'Shortcut/Workspace preference schemas use tenantPlugin',
      'models/*Preference.js',
      'medium'
    ),
    makeCheck(
      'auth-aggregate-with-tenant-crm',
      'authorization',
      'CRM stats aggregations use aggregateWithTenant',
      crmStatsSvc?.includes('aggregateWithTenant') && statsWorker?.includes('aggregateWithTenant')
        ? 'pass'
        : 'fail',
      'crmStatsService + statsWorker wrap Lead.aggregate',
      'domains/crm/services/crmStatsService.js',
      'high'
    ),
    makeCheck(
      'auth-aggregate-with-tenant-mail',
      'authorization',
      'Mail event aggregations use aggregateWithTenant',
      mailEventQuerySvc?.includes('aggregateWithTenant') ? 'pass' : 'fail',
      'mailEventQueryService wraps MailEvent.aggregate',
      'domains/mail/services/mailEventQueryService.js',
      'high'
    ),
  );
  const routeFiles = await listFiles(path.join(SERVER_ROOT, 'routes'));
  const bypassInRoutes = [];
  for (const file of routeFiles) {
    const content = await require('fs').promises.readFile(file, 'utf8');
    if (content.includes('bypassTenant')) bypassInRoutes.push(path.basename(file));
  }
  const unexpectedBypass = bypassInRoutes.filter((f) => !BYPASS_ROUTE_ALLOWLIST.has(f));
  const svcHasBypass = (dataHubSvc && dataHubSvc.includes('bypassTenant'))
    || (artistPathHubSvc && artistPathHubSvc.includes('bypassTenant'));
  checks.push(
    makeCheck(
      'auth-datahub-bypass-scoped',
      'authorization',
      'bypassTenant usage scoped to service layer only',
      unexpectedBypass.length === 0 && svcHasBypass ? 'pass' : unexpectedBypass.length ? 'fail' : 'warn',
      unexpectedBypass.length
        ? `bypassTenant in routes: ${unexpectedBypass.join(', ')}`
        : bypassInRoutes.length
          ? `bypassTenant only on allowlisted mail/calendar routes (${bypassInRoutes.join(', ')})`
          : svcHasBypass
            ? 'bypassTenant confined to service layer'
            : 'DataHubService bypassTenant not found',
      bypassInRoutes.join(', ') || 'routes clean',
      'high'
    )
  );

  return checks;
}

module.exports = { runSuite3StaticChecks };
