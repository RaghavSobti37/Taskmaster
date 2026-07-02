const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../middleware/authMiddleware');

const dataHubAccess = requirePageAccess('admin_data');
const dataHubController = require('./controllers/dataHubController');
const { auditSensitiveMutation } = require('../../services/securityAuditService');
const { validateQuery } = require('../../validation/validateQuery');
const {
  dataHubPeopleQuery,
  dataHubPersonQuery,
  dataHubAnalyticsQuery,
  dataHubReconcileQuery,
  dataHubBackupQuery,
} = require('../../validation/schemas/dataHub');

router.get('/folders', protect, dataHubAccess, dataHubController.getFolders);
router.get('/people', protect, dataHubAccess, validateQuery(dataHubPeopleQuery), dataHubController.listPeople);
router.get('/people/:id', protect, dataHubAccess, validateQuery(dataHubPersonQuery), dataHubController.getPerson);
router.get('/analytics', protect, dataHubAccess, validateQuery(dataHubAnalyticsQuery), dataHubController.getAnalytics);
router.get('/analytics/overlap', protect, dataHubAccess, dataHubController.getOverlap);
router.get('/sync-status', protect, dataHubAccess, dataHubController.getSyncStatus);
router.post('/reconcile', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'RECONCILE' }), validateQuery(dataHubReconcileQuery), dataHubController.reconcile);
router.get('/backups', protect, dataHubAccess, dataHubController.listBackups);
router.get('/backup/progress', protect, dataHubAccess, dataHubController.getBackupProgress);
router.post('/backup', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'BACKUP' }), validateQuery(dataHubBackupQuery), dataHubController.runProductionBackup);

module.exports = router;
