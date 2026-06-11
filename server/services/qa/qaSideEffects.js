/**
 * Side effect scanner: notifications, emails, logs, audit entries, queue jobs, redis keys.
 */
const Notification = require('../../models/Notification');
const Log = require('../../models/Log');
const CRMAudit = require('../../models/CRMAudit');
const XPAuditLog = require('../../models/XPAuditLog');
const { getSharedRedis } = require('../../utils/sharedRedis');

const BYPASS = { bypassTenant: true };

async function scanQaSideEffects({ since, testRunId } = {}) {
  const sinceDate = since || new Date(Date.now() - 3600000);
  const report = {
    scannedAt: new Date(),
    since: sinceDate,
    testRunId: testRunId || null,
    notifications: 0,
    activityLogs: 0,
    crmAudits: 0,
    xpAudits: 0,
    redisKeys: 0,
    redisAvailable: false,
    queueJobs: null,
    warnings: [],
  };

  const notifFilter = {
    createdAt: { $gte: sinceDate },
    $or: [
      { title: { $regex: /^QA /i } },
      { message: { $regex: /qa probe|qa test/i } },
    ],
  };
  report.notifications = await Notification.countDocuments(notifFilter).setOptions(BYPASS);

  report.activityLogs = await Log.countDocuments({
    createdAt: { $gte: sinceDate },
    $or: [
      { action: 'QA_TEST' },
      { module: 'QA_TESTING' },
      { origin: 'QA_AGENT_TEST' },
    ],
  }).setOptions(BYPASS);

  report.crmAudits = await CRMAudit.countDocuments({ createdAt: { $gte: sinceDate } }).setOptions(BYPASS);
  report.xpAudits = await XPAuditLog.countDocuments({
    createdAt: { $gte: sinceDate },
    'details.qaProbe': true,
  }).catch(() => 0);

  const redis = getSharedRedis();
  if (redis && redis.status === 'ready') {
    report.redisAvailable = true;
    try {
      const keys = await redis.keys('qa:*');
      report.redisKeys = keys?.length || 0;
      if (report.redisKeys > 0) {
        report.warnings.push(`${report.redisKeys} qa:* redis keys present`);
      }
    } catch (err) {
      report.warnings.push(`Redis scan failed: ${err.message}`);
    }
  }

  try {
    const { getQueueAdminSnapshot } = require('../queueAdminService');
    const stats = await getQueueAdminSnapshot();
    report.queueJobs = stats;
    if (stats?.redisAvailable === false) {
      report.warnings.push('Queue admin: redis unavailable');
    }
  } catch {
    report.queueJobs = { redisAvailable: false, note: 'queueAdminService not available' };
  }

  if (report.notifications > 50) {
    report.warnings.push(`High QA notification count: ${report.notifications}`);
  }

  return report;
}

async function buildSideEffectVerificationCase(testRunStart) {
  return {
    name: '[Cleanup] Side effect scan',
    category: 'rollback',
    severity: 'medium',
    checklistId: 'side-effect-scan',
    qaMeta: { kind: 'side-effects', action: 'Scan notifications/logs/redis after run', layer: 'cleanup' },
    test: async () => {
      const scan = await scanQaSideEffects({ since: testRunStart });
      const issues = scan.warnings.length + (scan.redisKeys > 0 ? 1 : 0);
      return {
        passed: issues === 0,
        checkStatus: issues === 0 ? 'pass' : 'warn',
        description: `notifications=${scan.notifications} logs=${scan.activityLogs} audits=${scan.crmAudits} redis=${scan.redisKeys}`,
        result: scan,
        message: issues === 0 ? 'No unexpected side effects' : scan.warnings.join('; '),
      };
    },
  };
}

module.exports = {
  scanQaSideEffects,
  buildSideEffectVerificationCase,
};
