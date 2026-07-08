const express = require('express');
const multer = require('multer');
const os = require('os');
const path = require('path');
const router = express.Router();
const { protect, requirePageAccess } = require('../../middleware/authMiddleware');

const dataHubAccess = requirePageAccess('admin_data');
const dataHubController = require('./controllers/dataHubController');
const { auditSensitiveMutation } = require('../../services/securityAuditService');
const { validateQuery } = require('../../validation/validateQuery');
const { validateBody } = require('../../validation/validateBody');
const {
  dataHubPeopleQuery,
  dataHubPersonQuery,
  dataHubAnalyticsQuery,
  dataHubReconcileQuery,
  dataHubBackupQuery,
  dataHubBulkDeleteBody,
} = require('../../validation/schemas/dataHub');

const campaignUpload = multer({
  dest: path.join(os.tmpdir(), 'coreknot-campaign-uploads'),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.get('/folders', protect, dataHubAccess, dataHubController.getFolders);
router.get('/people', protect, dataHubAccess, validateQuery(dataHubPeopleQuery), dataHubController.listPeople);
router.post('/people/bulk-delete', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'BULK_DELETE_PEOPLE' }), validateBody(dataHubBulkDeleteBody), dataHubController.bulkDeletePeople);
router.get('/people/:id', protect, dataHubAccess, validateQuery(dataHubPersonQuery), dataHubController.getPerson);
router.get('/analytics', protect, dataHubAccess, validateQuery(dataHubAnalyticsQuery), dataHubController.getAnalytics);
router.get('/analytics/overlap', protect, dataHubAccess, dataHubController.getOverlap);
router.get('/sync-status', protect, dataHubAccess, dataHubController.getSyncStatus);
router.post('/reconcile', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'RECONCILE' }), validateQuery(dataHubReconcileQuery), dataHubController.reconcile);
router.post('/rebuild-person-hub', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'REBUILD_HUB' }), dataHubController.rebuildPersonHub);
router.get('/backups', protect, dataHubAccess, dataHubController.listBackups);
router.get('/backup/progress', protect, dataHubAccess, dataHubController.getBackupProgress);
router.post('/backup', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'BACKUP' }), validateQuery(dataHubBackupQuery), dataHubController.runProductionBackup);
router.get('/campaign-outcomes', protect, dataHubAccess, dataHubController.listCampaignOutcomes);
router.get('/campaign-outcomes/:campaignName/recipients', protect, dataHubAccess, dataHubController.getCampaignOutcomeRecipients);
router.post('/campaign-outcomes/register', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'CAMPAIGN_REGISTER' }), dataHubController.registerWhatsappCampaign);
router.post('/campaign-outcomes/import', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'CAMPAIGN_IMPORT' }), campaignUpload.single('file'), dataHubController.importCampaignOutcomes);
router.post('/campaign-outcomes/sync-aisensy', protect, dataHubAccess, auditSensitiveMutation({ resourceType: 'DataHub', action: 'CAMPAIGN_AISENSY_SYNC' }), dataHubController.syncAisensyCampaignCatalog);

module.exports = router;
