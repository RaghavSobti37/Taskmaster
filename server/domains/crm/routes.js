const express = require('express');
const router = express.Router();
const crmController = require('./controllers/crmController');
const { protect, admin } = require('../../middleware/authMiddleware');
const { hasCrmPageAccess } = require('../../utils/departmentPermissions');
const { getPlatformOwnerUserId } = require('../../../shared/platformUserIds');
const { validateBody } = require('../../validation/validateBody');
const { createLeadBody, updateLeadBody, leadNoteBody } = require('../../validation/schemas/crm');
const { checkLock } = require('../../middleware/concurrencyMiddleware');
const Lead = require('./models/Lead');

const multer = require('multer');
const path = require('path');
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  },
});

function requireCrmAccess(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (hasCrmPageAccess(user)) return next();
  const ownerId = getPlatformOwnerUserId();
  if (ownerId && String(user._id) === String(ownerId)) return next();
  return res.status(403).json({ error: 'CRM access required' });
}

router.use(protect);

router.get('/export', admin, crmController.exportLeads);
router.get('/purge-logs', admin, crmController.getPurgeLogs);
router.delete('/imports/:id', admin, crmController.deleteImport);
router.post('/reset', admin, crmController.resetCRM);
router.get('/debug/columns', admin, crmController.getDebugColumns);
router.post('/debug/save-mapping', admin, crmController.saveMapping);
router.post('/sync-unsubscribed', admin, async (req, res) => {
  try {
    const { syncAndCleanUnsubscribeSheet } = require('../../services/holySheetService');
    const result = await syncAndCleanUnsubscribeSheet();
    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const artistCrmController = require('./controllers/artistCrmController');
router.get('/artist/templates', artistCrmController.requireArtistCrmAccess, artistCrmController.getArtistTemplates);
router.get('/artist/assignees', artistCrmController.requireArtistCrmAccess, artistCrmController.getArtistCallAssignees);
router.post('/artist/preview', artistCrmController.requireArtistCrmAccess, upload.single('file'), artistCrmController.previewArtistCsv);
router.post('/artist/upload', artistCrmController.requireArtistCrmAccess, upload.single('file'), artistCrmController.uploadArtistCsv);
router.post('/artist/import', admin, artistCrmController.importArtistFromPath);

router.delete('/leads/cleanup-test-data', admin, crmController.cleanupTestData);

router.get('/leads/audit-logs', admin, crmController.getAllAuditLogs);
router.delete('/leads/audit-logs/purge', admin, crmController.purgeAuditLogs);

router.use(requireCrmAccess);

router.post('/leads/upload', upload.single('file'), crmController.uploadLeads);
router.get('/stats', crmController.getCRMStats);
router.get('/rep-summary', crmController.getRepSummary);
router.get('/config', crmController.getCRMConfig);
router.get('/imports', crmController.getImports);
router.get('/import/status/:jobId', crmController.getImportJobStatus);
router.get('/followups', crmController.getFollowups);

router.route('/leads')
  .get(crmController.getLeads)
  .post(validateBody(createLeadBody), crmController.createLead);

router.route('/leads/:id')
  .get(crmController.getLead)
  .put(validateBody(updateLeadBody), checkLock(Lead), crmController.updateLead)
  .delete(crmController.deleteLead);

router.post('/leads/:id/notes', validateBody(leadNoteBody), crmController.addNote);
router.post('/leads/:id/lock-heartbeat', crmController.heartbeatLeadLock);
router.post('/leads/:id/unlock', crmController.releaseLeadLock);

router.route('/leads/:leadId/emis')
  .get(crmController.getEmis)
  .post(crmController.createEmi);

router.route('/emis/:id')
  .put(crmController.updateEmi);

router.route('/leads/:leadId/audit')
  .get(crmController.getAuditLogs);

module.exports = router;
