const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const { protect, admin } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/leads')
  .get(crmController.getLeads)
  .post(crmController.createLead);

router.route('/leads/:id')
  .put(crmController.updateLead);

router.route('/leads/:leadId/emis')
  .get(crmController.getEmis)
  .post(crmController.createEmi);

router.route('/emis/:id')
  .put(crmController.updateEmi);

router.route('/leads/:leadId/audit')
  .get(crmController.getAuditLogs);

module.exports = router;
