const { makeCheck, readText, readRepoText } = require('./qaCheckUtils');

/**
 * Suite 5 — v1.9.11+ product features (task history, creator/assignee split, mail HTML pipeline).
 */
async function runSuite5FeatureChecks() {
  const checks = [];
  const taskRoutes = await readText('domains/tasks/routes.js');
  const taskSvc = await readText('domains/tasks/services/TaskService.js');
  const taskCtrl = await readText('domains/tasks/controllers/taskController.js');
  const taskActivitySvc = await readText('domains/tasks/services/TaskActivityService.js');
  const taskActivityModel = await readText('domains/tasks/models/TaskActivity.js');
  const mentionReceipt = await readText('domains/tasks/models/TaskMentionReceipt.js');
  const taskAccess = await readText('utils/taskAccess.js');
  const mentionNotif = await readText('utils/mentionNotifications.js');
  const taskReviewShared = await readRepoText('shared/taskReviewRules.js');
  const deprecatedAutoMailerRoutes = await readText('routes/deprecatedAutoMailerRoutes.js');
  const queueService = await readText('services/queueService.js');
  const transactionalMailDriver = await readText('services/mailDriver.js');
  const autoMailerContract = await readRepoText('shared/contracts/mail.js');
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
      'domains/tasks/routes.js',
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
      'domains/tasks/services/TaskActivityService.js',
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
      'domains/tasks/models/TaskActivity.js',
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
      'domains/tasks/models/TaskMentionReceipt.js',
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
      'domains/tasks/services/TaskService.js',
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
      'domains/tasks/controllers/taskController.js',
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
      'feat-email-auto-mailer-boundary',
      'business-logic',
      'CoreKnot campaign mail endpoints point to Auto-Mailer',
      deprecatedAutoMailerRoutes && deprecatedAutoMailerRoutes.includes('Moved to Auto-Mailer')
        ? 'pass'
        : 'fail',
      'deprecatedAutoMailerRoutes returns moved contract for mail/campaign/newsletter paths',
      'routes/deprecatedAutoMailerRoutes.js',
      'high'
    ),
    makeCheck(
      'feat-campaign-dispatch-blocked',
      'business-logic',
      'CoreKnot campaign dispatch is blocked',
      queueService && queueService.includes('Blocked CoreKnot campaign dispatch')
        ? 'pass'
        : 'fail',
      'queueService refuses campaign send work and points to Auto-Mailer',
      'services/queueService.js',
      'high'
    ),
    makeCheck(
      'feat-transactional-mail-bridge',
      'business-logic',
      'Transactional email delegates through Auto-Mailer bridge',
      transactionalMailDriver && transactionalMailDriver.includes('/api/transactional/send')
        ? 'pass'
        : 'fail',
      'mailDriver delegates provider delivery to Auto-Mailer',
      'services/mailDriver.js',
      'medium'
    ),
    makeCheck(
      'feat-mail-moved-contract',
      'business-logic',
      'Shared mail contract exposes moved-to-Auto-Mailer response',
      autoMailerContract && autoMailerContract.includes('auto-mailer')
        ? 'pass'
        : 'warn',
      'shared/contracts/mail.js documents moved mail capability',
      'shared/contracts/mail.js',
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
