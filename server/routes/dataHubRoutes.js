const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const dataHubController = require('../controllers/dataHubController');

router.get('/folders', protect, admin, dataHubController.getFolders);
router.get('/people', protect, admin, dataHubController.listPeople);
router.get('/people/:id', protect, admin, dataHubController.getPerson);
router.get('/analytics', protect, admin, dataHubController.getAnalytics);
router.get('/analytics/overlap', protect, admin, dataHubController.getOverlap);
router.get('/sync-status', protect, admin, dataHubController.getSyncStatus);
router.post('/reconcile', protect, admin, dataHubController.reconcile);
router.get('/backups', protect, admin, dataHubController.listBackups);
router.get('/backup/progress', protect, admin, dataHubController.getBackupProgress);
router.post('/backup', protect, admin, dataHubController.runProductionBackup);

module.exports = router;
