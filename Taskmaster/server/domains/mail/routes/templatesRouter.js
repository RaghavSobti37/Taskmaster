const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const { validateBody } = require('../../../validation/validateBody');
const {
  mailTemplateDraftBody,
  mailTemplateRejectBody,
} = require('../../../validation/schemas/mail');
const templatesController = require('../controllers/templatesController');

const emailsAccess = requirePageAccess('emails');

router.use(protect, emailsAccess);

router.get('/templates/pending', templatesController.listPending);
router.get('/templates', templatesController.list);
router.get('/templates/:id', templatesController.getById);
router.post('/templates', validateBody(mailTemplateDraftBody), templatesController.saveDraft);
router.put('/templates/:id', validateBody(mailTemplateDraftBody), templatesController.update);
router.post('/templates/:id/submit', templatesController.submit);
router.post('/templates/:id/approve', templatesController.approve);
router.post('/templates/:id/reject', validateBody(mailTemplateRejectBody), templatesController.reject);
router.delete('/templates/:id', templatesController.remove);

module.exports = router;
