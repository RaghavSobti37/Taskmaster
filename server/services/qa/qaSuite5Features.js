const { makeCheck, readText, readRepoText } = require('./qaCheckUtils');

/**
 * Suite 5 — v1.9.11+ product features (task history, creator/assignee split, mail HTML pipeline).
 */
async function runSuite5FeatureChecks() {
  const checks = [];
  const taskRoutes = await readText('routes/taskRoutes.js');
  const taskSvc = await readText('services/TaskService.js');
  const taskCtrl = await readText('controllers/taskController.js');
  const taskActivitySvc = await readText('services/TaskActivityService.js');
  const taskActivityModel = await readText('models/TaskActivity.js');
  const mentionReceipt = await readText('models/TaskMentionReceipt.js');
  const taskAccess = await readText('utils/taskAccess.js');
  const mentionNotif = await readText('utils/mentionNotifications.js');
  const taskReviewShared = await readRepoText('shared/taskReviewRules.js');
  const buildFinalHtml = await readText('utils/buildFinalEmailHtml.js');
  const normalizeOutbound = await readText('utils/normalizeOutboundEmailHtml.js');
  const indexedVars = await readText('utils/indexedTemplateVariables.js');
  const mailHelpers = await readText('utils/mailTemplateHelpers.js');
  const taskDetailModal = await readRepoText('client/src/components/TaskDetailModal.jsx');
  const mentionTokensClient = await readRepoText('client/src/utils/mentionTokens.js');

  checks.push(
    makeCheck(
      'feat-task-activity-routes',
      'business-logic',
      'Task activity GET/POST routes mounted',
      taskRoutes &&
        taskRoutes.includes('/:id/activity') &&
        taskRoutes.includes('getTaskActivity') &&
        taskRoutes.includes('postTaskActivity')
        ? 'pass'
        : 'fail',
      'taskRoutes exposes thread read + post',
      'routes/taskRoutes.js',
      'high'
    ),
    makeCheck(
      'feat-task-activity-service',
      'business-logic',
      'TaskActivityService seeds created row + thread messages',
      taskActivitySvc &&
        taskActivitySvc.includes('seedCreatedAndAssignments') &&
        taskActivitySvc.includes("type: 'message'")
        ? 'pass'
        : 'fail',
      'TaskActivityService handles created + message events',
      'services/TaskActivityService.js',
      'high'
    ),
    makeCheck(
      'feat-task-activity-model',
      'business-logic',
      'TaskActivity model types (created, assignment, message)',
      taskActivityModel &&
        taskActivityModel.includes("'created'") &&
        taskActivityModel.includes("'assignment'") &&
        taskActivityModel.includes("'message'")
        ? 'pass'
        : 'fail',
      'TaskActivity schema supports timeline event types',
      'models/TaskActivity.js',
      'medium'
    ),
    makeCheck(
      'feat-mention-receipt-model',
      'business-logic',
      'TaskMentionReceipt tracks unread @mentions per task',
      mentionReceipt && mentionReceipt.includes('unreadCount')
        ? 'pass'
        : 'fail',
      'TaskMentionReceipt model present for badge counts',
      'models/TaskMentionReceipt.js',
      'high'
    ),
    makeCheck(
      'feat-creator-not-in-assignments',
      'business-logic',
      'Creator excluded from TaskAssignment rows (taskAccess)',
      taskAccess && taskAccess.includes('normalizeAssigneeIds')
        ? 'pass'
        : 'fail',
      'taskAccess.normalizeAssigneeIds strips creator from assignee list',
      'utils/taskAccess.js',
      'critical'
    ),
    makeCheck(
      'feat-review-rules-delegation',
      'business-logic',
      'Shared taskReviewRules requiresReviewForUser + canUserApproveReview',
      taskReviewShared &&
        taskReviewShared.includes('requiresReviewForUser') &&
        taskReviewShared.includes('canUserApproveReview')
        ? 'pass'
        : 'fail',
      'Delegated completion uses shared review rules',
      'shared/taskReviewRules.js',
      'critical'
    ),
    makeCheck(
      'feat-review-resubmit-routing',
      'business-logic',
      'needsReviewOnComplete + canUserApproveOrRollback in shared rules',
      taskReviewShared &&
        taskReviewShared.includes('needsReviewOnComplete') &&
        taskReviewShared.includes('canUserApproveOrRollback')
        ? 'pass'
        : 'fail',
      'Re-submit after rollback and platform-owner rollback use shared review helpers',
      'shared/taskReviewRules.js',
      'critical'
    ),
    makeCheck(
      'feat-review-preserve-assigner',
      'business-logic',
      'TaskService buildAssignmentsForUser preserves assignedBy on edit',
      taskSvc &&
        taskSvc.includes('prevAssignerByUser') &&
        taskSvc.includes('previousAssignments')
        ? 'pass'
        : 'fail',
      'Assignee list edits keep original reviewer chain',
      'services/TaskService.js',
      'high'
    ),
    makeCheck(
      'feat-bug-platform-owner',
      'business-logic',
      'Bug report resolves platform owner via resolvePlatformOwnerUser',
      taskCtrl &&
        taskCtrl.includes('resolvePlatformOwnerUser') &&
        taskCtrl.includes('Bug Reported')
        ? 'pass'
        : 'fail',
      'Bug tasks auto-assign to platform owner with notification',
      'controllers/taskController.js',
      'high'
    ),
    makeCheck(
      'feat-thread-mention-notify',
      'business-logic',
      'Thread @mentions use resolveNewlyMentionedUserIds',
      mentionNotif &&
        mentionNotif.includes('resolveNewlyMentionedUserIds') &&
        mentionNotif.includes("source === 'thread'")
        ? 'pass'
        : 'fail',
      'mentionNotifications supports thread-only mention deltas',
      'utils/mentionNotifications.js',
      'high'
    ),
    makeCheck(
      'feat-task-detail-history-ui',
      'frontend',
      'TaskDetailModal renders history & conversation panel',
      taskDetailModal && taskDetailModal.includes('TaskHistoryPanel')
        ? 'pass'
        : 'warn',
      'TaskDetailModal wires activity/history UI',
      'client/src/components/TaskDetailModal.jsx',
      'medium'
    ),
    makeCheck(
      'feat-mention-tokens-parity',
      'business-logic',
      'Client mention token helpers mirror server',
      mentionTokensClient && mentionTokensClient.includes('extractUserMentionLabels')
        ? 'pass'
        : 'warn',
      'client/src/utils/mentionTokens.js shares label extraction',
      'client/src/utils/mentionTokens.js',
      'low'
    ),
    makeCheck(
      'feat-email-build-final-html',
      'business-logic',
      'Outbound email uses buildFinalEmailHtml pipeline',
      buildFinalHtml && buildFinalHtml.includes('buildFinalEmailHtml')
        ? 'pass'
        : 'fail',
      'buildFinalEmailHtml composes signature + body',
      'utils/buildFinalEmailHtml.js',
      'high'
    ),
    makeCheck(
      'feat-email-normalize-outbound',
      'business-logic',
      'normalizeOutboundEmailHtml sanitizes campaign HTML',
      normalizeOutbound && normalizeOutbound.includes('normalizeOutboundEmailHtml')
        ? 'pass'
        : 'fail',
      'normalizeOutboundEmailHtml present for send path',
      'utils/normalizeOutboundEmailHtml.js',
      'high'
    ),
    makeCheck(
      'feat-indexed-template-variables',
      'business-logic',
      'Indexed template variables (server) for mail merge',
      indexedVars && indexedVars.includes('parseIndexedVariables')
        ? 'pass'
        : 'fail',
      'indexedTemplateVariables utility for HolySheet merge fields',
      'utils/indexedTemplateVariables.js',
      'medium'
    ),
    makeCheck(
      'feat-mail-template-helpers',
      'business-logic',
      'mailTemplateHelpers centralizes template notifications',
      mailHelpers && mailHelpers.includes('mailTemplate')
        ? 'pass'
        : 'warn',
      'mailTemplateHelpers module exists',
      'utils/mailTemplateHelpers.js',
      'low'
    ),
    makeCheck(
      'feat-qa-excluded-users-registry',
      'business-logic',
      'QA excluded users list (no notify/email during probes)',
      (await readRepoText('shared/qaExcludedUsers.js'))?.includes('redacted-staff@example.com')
        ? 'pass'
        : 'fail',
      'shared/qaExcludedUsers.js blocks QA side effects for listed staff',
      'shared/qaExcludedUsers.js',
      'high'
    )
  );

  return checks;
}

module.exports = { runSuite5FeatureChecks };
