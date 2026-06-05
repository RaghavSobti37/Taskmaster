const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const dataHubController = require('../controllers/dataHubController');
const { validateQuery } = require('../validation/validateQuery');
const {
  dataHubPeopleQuery,
  dataHubPersonQuery,
  dataHubAnalyticsQuery,
  dataHubReconcileQuery,
  dataHubBackupQuery,
} = require('../validation/schemas/dataHub');

router.get('/folders', protect, admin, dataHubController.getFolders);
router.get('/people', protect, admin, validateQuery(dataHubPeopleQuery), dataHubController.listPeople);
router.get('/people/:id', protect, admin, validateQuery(dataHubPersonQuery), dataHubController.getPerson);
router.get('/analytics', protect, admin, validateQuery(dataHubAnalyticsQuery), dataHubController.getAnalytics);
router.get('/analytics/overlap', protect, admin, dataHubController.getOverlap);
router.get('/sync-status', protect, admin, dataHubController.getSyncStatus);
router.post('/reconcile', protect, admin, validateQuery(dataHubReconcileQuery), dataHubController.reconcile);
router.get('/backups', protect, admin, dataHubController.listBackups);
router.get('/backup/progress', protect, admin, dataHubController.getBackupProgress);
router.post('/backup', protect, admin, validateQuery(dataHubBackupQuery), dataHubController.runProductionBackup);

module.exports = router;
