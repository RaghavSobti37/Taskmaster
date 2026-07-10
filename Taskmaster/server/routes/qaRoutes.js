const express = require('express');
const qaTestingController = require('../controllers/qaTestingController');
const { protect, requirePlatformAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const dataHubAccess = requirePlatformAdmin;

router.use(protect, dataHubAccess);

/**
 * @POST /api/qa/start
 * Start a new global QA testing session
 */
router.post('/start', qaTestingController.startQATesting);

router.get('/categories', qaTestingController.listCategories);
router.get('/lighthouse-routes', qaTestingController.listLighthouseRoutes);
router.get('/page-manifests', qaTestingController.listPageManifests);
router.get('/action-registry', qaTestingController.listActionRegistry);

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
 * @POST /api/qa/purge-test-data
 * Purge all QA-pattern contacts/leads from Data Hub, CRM, etc.
 */
router.post('/purge-test-data', qaTestingController.purgeAllTestData);

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
