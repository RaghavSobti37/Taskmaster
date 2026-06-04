const QATestRun = require('../models/QATestRun');
const QATestingService = require('../services/qaTestingService');
const { purgeQaTestData } = require('../services/qa/qaTestData');
const DataHubService = require('../services/DataHubService');
const logger = require('../utils/logger');
const { broadcastRealtimeEvent } = require('../config/realtime');

/** Start a new QA testing session */
exports.startQATesting = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { testAgentName, testRole, permissions, categories, lighthousePaths } = req.body || {};
    const normalizedCategories = Array.isArray(categories)
      ? [...new Set(categories.map((c) => String(c).trim()).filter(Boolean))]
      : [];
    const normalizedLighthousePaths = Array.isArray(lighthousePaths)
      ? [...new Set(lighthousePaths.map((p) => String(p).trim()).filter(Boolean))]
      : [];

    // Check if test already running globally
    const existingRun = await QATestRun.findOne({
      status: { $in: ['pending', 'in-progress'] }
    });

    if (existingRun) {
      return res.status(400).json({ error: 'A QA test is already running' });
    }

    // Start testing service
    const qaService = new QATestingService(null, userId, {
      testAgentName: testAgentName || 'QA Agent',
      testRole: testRole || 'user',
      permissions: permissions || [],
      categories: normalizedCategories,
      lighthousePaths: normalizedLighthousePaths,
    });

    await qaService.initTestRun();

    const { refreshExcludedUserIds } = require('../utils/qaExcludedUsers');
    const { clearResolveTestUsersCache } = require('../services/qa/qaApiClient');
    clearResolveTestUsersCache();
    await refreshExcludedUserIds();
    process.env.QA_SYNC_GAMIFICATION = 'true';
    qaService.executeTests().catch((err) => {
      logger.error('QA', 'Error in background testing', { error: err.message });
    }).finally(() => {
      delete process.env.QA_SYNC_GAMIFICATION;
    });

    broadcastRealtimeEvent(`qa-test:global`, 'started', {
      testRunId: qaService.testRunId,
      initiatedBy: userId,
    });

    res.status(202).json({
      success: true,
      testRunId: qaService.testRunId,
      message: 'QA testing started. Progress updates will be broadcast in real-time.'
    });
  } catch (error) {
    logger.error('QA', 'Error starting QA testing', { error: error.message });
    next(error);
  }
};

/** Get current test progress */
exports.getTestProgress = async (req, res, next) => {
  try {
    const testRunId = req.query.testRunId;

    let query = {};
    if (testRunId) {
      query._id = testRunId;
    } else {
      // Get latest test run
      query.status = { $in: ['pending', 'in-progress'] };
    }

    const testRun = await QATestRun.findOne(query).select(
      'status progress activityLog testCases pagesTestedCount bugsIdentified startedAt errorDetails lighthouseReport'
    );

    if (!testRun) {
      return res.json({ status: 'idle', testRunId: null, progress: null, testCases: [], pagesTestedCount: 0 });
    }

    res.json({
      testRunId: testRun._id,
      status: testRun.status,
      progress: testRun.progress,
      activityLog: testRun.activityLog || [],
      testCases: testRun.testCases,
      pagesTestedCount: testRun.pagesTestedCount,
      bugsIdentified: testRun.bugsIdentified,
      startedAt: testRun.startedAt,
      errorDetails: testRun.errorDetails,
    });
  } catch (error) {
    logger.error('QA', 'Error fetching test progress', { error: error.message });
    next(error);
  }
};

/** Get test results */
exports.getTestResults = async (req, res, next) => {
  try {
    const { testRunId } = req.params;

    const testRun = await QATestRun.findOne({
      _id: testRunId
    }).populate('bugsCreated', 'title priority status');

    if (!testRun) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    const predeployCategories = new Set([
      'authorization', 'password-reset', 'input-validation', 'cors', 'rate-limiting',
      'error-handling', 'database-indexes', 'logging-monitoring', 'rollback', 'business-logic',
      'security-hardening',
    ]);
    const checklistCases = testRun.testCases.filter((t) => predeployCategories.has(t.category));
    const byCategory = {};
    for (const tc of checklistCases) {
      if (!byCategory[tc.category]) {
        byCategory[tc.category] = { pass: 0, fail: 0, warn: 0, skip: 0, checks: [] };
      }
      const bucket = byCategory[tc.category];
      const st = tc.checkStatus || (tc.status === 'failed' ? 'fail' : tc.status === 'warn' ? 'warn' : tc.status === 'skip' ? 'skip' : 'pass');
      if (st === 'fail') bucket.fail++;
      else if (st === 'warn') bucket.warn++;
      else if (st === 'skip') bucket.skip++;
      else bucket.pass++;
      bucket.checks.push(tc);
    }

    // Categorize test cases by result
    const results = {
      testRunId: testRun._id,
      selectedCategories: testRun.selectedCategories || [],
      startedAt: testRun.startedAt,
      completedAt: testRun.completedAt,
      testIdentity: testRun.testIdentity,
      totalTests: testRun.testCases.length,
      passed: testRun.testCases.filter(t => t.status === 'passed').length,
      failed: testRun.testCases.filter(t => t.status === 'failed').length,
      warned: testRun.testCases.filter(t => t.status === 'warn').length,
      skipped: testRun.testCases.filter(t => t.status === 'skip').length,
      passRate: testRun.testCases.length > 0 
        ? ((testRun.testCases.filter(t => t.status === 'passed').length / testRun.testCases.length) * 100).toFixed(2)
        : 0,
      checklistSummary: {
        total: checklistCases.length,
        pass: checklistCases.filter((t) => (t.checkStatus || t.status) === 'pass' || t.status === 'passed').length,
        fail: checklistCases.filter((t) => t.checkStatus === 'fail' || t.status === 'failed').length,
        warn: checklistCases.filter((t) => t.checkStatus === 'warn' || t.status === 'warn').length,
        skip: checklistCases.filter((t) => t.checkStatus === 'skip' || t.status === 'skip').length,
        byCategory,
      },
      lighthouseReport: testRun.lighthouseReport || null,
      testCases: testRun.testCases,
      bugsCreated: testRun.bugsCreated || [],
      cleanupResults: testRun.cleanupResults,
      duration: testRun.completedAt ? new Date(testRun.completedAt) - new Date(testRun.startedAt) : null
    };

    res.json(results);
  } catch (error) {
    logger.error('QA', 'Error fetching test results', { error: error.message });
    next(error);
  }
};

/** Cancel ongoing test */
exports.cancelTest = async (req, res, next) => {
  try {
    const { testRunId } = req.params;

    const testRun = await QATestRun.findOneAndUpdate(
      { _id: testRunId },
      { status: 'cancelled', completedAt: new Date() },
      { new: true }
    );

    if (!testRun) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    const qaService = new QATestingService(null, req.user._id);
    qaService.testRunId = testRunId;
    qaService.cleanupTestData().catch((err) => {
      logger.error('QA', 'Cleanup after cancel failed', { error: err.message, testRunId });
    });

    broadcastRealtimeEvent(`qa-test:global`, 'cancelled', {
      testRunId: testRunId
    });

    res.json({ success: true, message: 'Test cancelled; QA data cleanup started' });
  } catch (error) {
    logger.error('QA', 'Error cancelling test', { error: error.message });
    next(error);
  }
};

/** Manual cleanup of test data */
exports.cleanupTestData = async (req, res, next) => {
  try {
    const { testRunId } = req.params;

    const testRun = await QATestRun.findOne({ _id: testRunId });
    if (!testRun) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    // Trigger cleanup
    const qaService = new QATestingService(null, req.user._id);
    qaService.testRunId = testRunId;
    await qaService.cleanupTestData();

    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    logger.error('QA', 'Error cleaning up test data', { error: error.message });
    next(error);
  }
};

/** Routes available for Lighthouse audits in QA */
exports.listLighthouseRoutes = async (req, res) => {
  const {
    PUBLIC_ROUTES,
    PROTECTED_ROUTES,
    getAllLighthouseRoutes,
  } = require('../services/qa/lighthouseRoutes');
  res.json({
    public: PUBLIC_ROUTES,
    protected: PROTECTED_ROUTES,
    all: getAllLighthouseRoutes(),
  });
};

/** List available QA test categories for filtered runs */
exports.listCategories = async (req, res) => {
  const preDeploy = [
    'authorization', 'password-reset', 'input-validation', 'cors', 'rate-limiting',
    'error-handling', 'database-indexes', 'logging-monitoring', 'rollback', 'business-logic',
    'security-hardening',
  ];
  const dynamic = ['backend', 'permission', 'bottleneck', 'data', 'frontend', 'mobile', 'desktop'];
  const lighthouse = ['lighthouse'];
  res.json({
    preDeploy,
    dynamic,
    lighthouse,
    all: [...preDeploy, ...dynamic, ...lighthouse],
  });
};

/** Purge all QA-pattern data globally (Data Hub, CRM, logs) — no test run required */
exports.purgeAllTestData = async (req, res, next) => {
  try {
    const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');
    const GamificationService = require('../services/gamificationService');
    const swept = await purgeQaTestData();
    const phoneRepair = await repairCorruptLeadPhones();
    const xpRecalc = await GamificationService.recalculateUsersFromAudit(swept.affectedUserIds || []);
    DataHubService.clearFolderCache();
    res.json({
      success: true,
      message: `Purged ${swept.deleted.tasks} QA tasks, ${swept.deleted.xpAudits} XP audit rows, ${swept.deleted.users} probe users, and related CRM/logs. Re-synced XP for ${xpRecalc.updatedUsers} user(s). Repaired ${phoneRepair.repaired} corrupt phones.`,
      deleted: swept.deleted,
      phoneRepair,
      xpRecalc,
    });
  } catch (error) {
    logger.error('QA', 'Error purging QA test data', { error: error.message });
    next(error);
  }
};

/** List all test runs for a project */
exports.listTestRuns = async (req, res, next) => {
  try {
    const { limit = 10, skip = 0 } = req.query;

    const testRuns = await QATestRun.find({})
      .sort({ startedAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .select('status progress testCases pagesTestedCount bugsIdentified startedAt completedAt');

    const total = await QATestRun.countDocuments({});

    res.json({
      testRuns,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    logger.error('QA', 'Error listing test runs', { error: error.message });
    next(error);
  }
};

/** Mark a specific bug as resolved */
exports.resolveBug = async (req, res, next) => {
  try {
    const { testRunId, testCaseId } = req.params;
    const testRun = await QATestRun.findOne({ _id: testRunId });
    if (!testRun) {
      return res.status(404).json({ error: 'Test run not found' });
    }
    
    const testCaseIndex = testRun.testCases.findIndex(tc => tc._id.toString() === testCaseId);
    if (testCaseIndex === -1) {
      return res.status(404).json({ error: 'Test case bug not found' });
    }

    testRun.testCases[testCaseIndex].resolved = true;
    await testRun.save();

    res.json({ success: true, message: 'Bug marked as resolved' });
  } catch (error) {
    logger.error('QA', 'Error resolving bug', { error: error.message });
    next(error);
  }
};
