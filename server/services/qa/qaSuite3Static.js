const path = require('path');
const { makeCheck, readText, readRepoText, listFiles, SERVER_ROOT, REPO_ROOT } = require('./qaCheckUtils');

/**
 * Suite 3 — 20 extended static checks (code/config analysis).
 */
async function runSuite3StaticChecks() {
  const checks = [];
  const leadModel = await readText('models/Lead.js');
  const contactModel = await readText('models/Contact.js');
  const taskModel = await readText('models/Task.js');
  const clientDate = await readRepoText('client/src/utils/dateValidation.js');
  const crmCtrl = await readText('controllers/crmController.js');
  const taskSvc = await readText('services/TaskService.js');
  const announcementRoutes = await readText('routes/announcementRoutes.js');
  const uploadthing = await readText('config/uploadthing.js');
  const taskAssignment = await readText('models/TaskAssignment.js');
  const projectModel = await readText('models/Project.js');
  const xpAudit = await readText('models/XPAuditLog.js');
  const notifDisp = await readText('services/notificationDispatcher.js');
  const bgQueue = await readText('services/backgroundQueue.js');
  const crmSnapshot = await readText('models/CRMStatSnapshot.js');
  const financeRoutes = await readText('routes/financeRoutes.js');
  const dataHubRoutes = await readText('routes/dataHubRoutes.js');
  const dataHubSvc = await readText('services/DataHubService.js');

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
      'models/Contact.js',
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
      crmCtrl && /sanitizeEmail|sanitizeName|normalizePhone/.test(crmCtrl) ? 'pass' : 'fail',
      'crmController uses sanitizer utilities',
      'controllers/crmController.js',
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
  );

  const routeFiles = await listFiles(path.join(SERVER_ROOT, 'routes'));
  const bypassInRoutes = [];
  for (const file of routeFiles) {
    const content = await require('fs').promises.readFile(file, 'utf8');
    if (content.includes('bypassTenant')) bypassInRoutes.push(path.basename(file));
  }
  const svcHasBypass = dataHubSvc && dataHubSvc.includes('bypassTenant');
  checks.push(
    makeCheck(
      'auth-datahub-bypass-scoped',
      'authorization',
      'bypassTenant usage scoped to service layer only',
      bypassInRoutes.length === 0 && svcHasBypass ? 'pass' : bypassInRoutes.length ? 'fail' : 'warn',
      bypassInRoutes.length
        ? `bypassTenant in routes: ${bypassInRoutes.join(', ')}`
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
