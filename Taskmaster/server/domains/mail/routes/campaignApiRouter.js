const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const { validateBody } = require('../../../validation/validateBody');
const {
  createCampaignBody,
  resendCampaignBody,
  resendFilteredCampaignBody,
} = require('../../../validation/schemas/campaigns');
const campaignApiController = require('../controllers/campaignApiController');

const emailsAccess = requirePageAccess('emails');

router.use(protect, emailsAccess);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', campaignApiController.list);
router.post('/upload-attachment', upload.single('file'), campaignApiController.uploadAttachment);
router.get('/:id/recipients/export', campaignApiController.exportRecipients);
router.get('/:id/recipients', campaignApiController.getRecipients);
router.get('/:id/analytics', campaignApiController.getAnalytics);
router.get('/:id', campaignApiController.getById);
router.post('/', validateBody(createCampaignBody), campaignApiController.create);
router.post('/:id/dispatch', campaignApiController.dispatch);
router.post('/:id/resend', validateBody(resendCampaignBody), campaignApiController.resend);
router.post('/:id/resend-filtered', validateBody(resendFilteredCampaignBody), campaignApiController.resendFiltered);
router.post('/:id/stop', campaignApiController.stop);
router.delete('/:id', campaignApiController.remove);

module.exports = router;
