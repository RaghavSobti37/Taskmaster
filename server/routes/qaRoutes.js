const express = require('express');
const qaTestingController = require('../controllers/qaTestingController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, admin);

/**
 * @POST /api/qa/start
 * Start a new global QA testing session
 */
router.post('/start', qaTestingController.startQATesting);

/**
 * @GET /api/qa/progress
 * Get real-time progress of ongoing test
 * Query: ?testRunId={id} (optional, otherwise gets latest)
 */
router.get('/progress', qaTestingController.getTestProgress);

/**
 * @GET /api/qa/results/:testRunId
 * Get final test results and bugs created
 */
router.get('/results/:testRunId', qaTestingController.getTestResults);

/**
 * @POST /api/qa/cancel/:testRunId
 * Cancel an ongoing or pending test
 */
router.post('/cancel/:testRunId', qaTestingController.cancelTest);

/**
 * @POST /api/qa/cleanup/:testRunId
 * Manually trigger cleanup of test data
 */
router.post('/cleanup/:testRunId', qaTestingController.cleanupTestData);

/**
 * @GET /api/qa/history
 * Get list of all test runs
 * Query: ?limit=10&skip=0
 */
router.get('/history', qaTestingController.listTestRuns);

/**
 * @POST /api/qa/resolve/:testRunId/:testCaseId
 * Mark a bug as solved
 */
router.post('/resolve/:testRunId/:testCaseId', qaTestingController.resolveBug);

module.exports = router;
