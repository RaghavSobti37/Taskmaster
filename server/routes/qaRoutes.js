const express = require('express');
const qaTestingController = require('../controllers/qaTestingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All QA routes require authentication
router.use(protect);

/**
 * @POST /api/projects/:projectId/qa/start
 * Start a new QA testing session for a project
 */
router.post('/:projectId/qa/start', qaTestingController.startQATesting);

/**
 * @GET /api/projects/:projectId/qa/progress
 * Get real-time progress of ongoing test
 * Query: ?testRunId={id} (optional, otherwise gets latest)
 */
router.get('/:projectId/qa/progress', qaTestingController.getTestProgress);

/**
 * @GET /api/projects/:projectId/qa/results/:testRunId
 * Get final test results and bugs created
 */
router.get('/:projectId/qa/results/:testRunId', qaTestingController.getTestResults);

/**
 * @POST /api/projects/:projectId/qa/cancel/:testRunId
 * Cancel an ongoing or pending test
 */
router.post('/:projectId/qa/cancel/:testRunId', qaTestingController.cancelTest);

/**
 * @POST /api/projects/:projectId/qa/cleanup/:testRunId
 * Manually trigger cleanup of test data
 */
router.post('/:projectId/qa/cleanup/:testRunId', qaTestingController.cleanupTestData);

/**
 * @GET /api/projects/:projectId/qa/history
 * Get list of all test runs for a project
 * Query: ?limit=10&skip=0
 */
router.get('/:projectId/qa/history', qaTestingController.listTestRuns);

module.exports = router;
