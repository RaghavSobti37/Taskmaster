const QATestRun = require('../models/QATestRun');
const QATestingService = require('../services/qaTestingService');
const logger = require('../utils/logger');
const { broadcastRealtimeEvent } = require('../config/realtime');

/** Start a new QA testing session */
exports.startQATesting = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { testAgentName, testRole, permissions } = req.body || {};

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
      permissions: permissions || []
    });

    // Start async testing (don't wait for completion)
    qaService.startTesting().catch(err => {
      logger.error('QA', 'Error in background testing', { error: err.message });
    });

    // Broadcast that testing started
    broadcastRealtimeEvent(`qa-test:global`, 'started', {
      testRunId: qaService.testRunId,
      initiatedBy: userId
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
      'status progress testCases pagesTestedCount bugsIdentified startedAt'
    );

    if (!testRun) {
      return res.json({ status: 'idle', testRunId: null, progress: null, testCases: [], pagesTestedCount: 0 });
    }

    res.json({
      testRunId: testRun._id,
      status: testRun.status,
      progress: testRun.progress,
      testCases: testRun.testCases,
      pagesTestedCount: testRun.pagesTestedCount,
      bugsIdentified: testRun.bugsIdentified,
      startedAt: testRun.startedAt
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

    // Categorize test cases by result
    const results = {
      totalTests: testRun.testCases.length,
      passed: testRun.testCases.filter(t => t.status === 'passed').length,
      failed: testRun.testCases.filter(t => t.status === 'failed').length,
      passRate: testRun.testCases.length > 0 
        ? ((testRun.testCases.filter(t => t.status === 'passed').length / testRun.testCases.length) * 100).toFixed(2)
        : 0,
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

    broadcastRealtimeEvent(`qa-test:global`, 'cancelled', {
      testRunId: testRunId
    });

    res.json({ success: true, message: 'Test cancelled' });
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
