const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const { protect, admin } = require('../middleware/authMiddleware');
const { checkLock } = require('../middleware/concurrencyMiddleware');
const Lead = require('../models/Lead');

const multer = require('multer');
const path = require('path');
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  }
});

router.use(protect);

router.post('/leads/upload', upload.single('file'), crmController.uploadLeads);
router.get('/export', admin, crmController.exportLeads);
router.get('/stats', crmController.getCRMStats);
router.get('/rep-summary', crmController.getRepSummary);
router.get('/config', crmController.getCRMConfig);
router.get('/imports', crmController.getImports);
router.get('/purge-logs', crmController.getPurgeLogs);
router.delete('/imports/:id', crmController.deleteImport);
router.post('/reset', crmController.resetCRM);
router.get('/debug/columns', crmController.getDebugColumns);
router.post('/debug/save-mapping', crmController.saveMapping);
router.post('/sync-bookings', require('../controllers/syncController').syncBookings);

router.delete('/leads/cleanup-test-data', crmController.cleanupTestData);

router.get('/followups', crmController.getFollowups);

router.route('/leads')
  .get(crmController.getLeads)
  .post(crmController.createLead);

router.get('/leads/audit-logs', admin, crmController.getAllAuditLogs);

router.route('/leads/:id')
  .put(checkLock(Lead), crmController.updateLead)
  .delete(admin, crmController.deleteLead);

router.post('/leads/:id/notes', crmController.addNote);

router.route('/leads/:leadId/emis')
  .get(crmController.getEmis)
  .post(crmController.createEmi);

router.route('/emis/:id')
  .put(crmController.updateEmi);

router.route('/leads/:leadId/audit')
  .get(crmController.getAuditLogs);

module.exports = router;
