const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const { validateBody } = require('../../../validation/validateBody');
const { createCampaignBody } = require('../../../validation/schemas/mail');
const campaignsController = require('../controllers/campaignsController');

const emailsAccess = requirePageAccess('emails');

router.use(protect, emailsAccess);

router.get('/campaigns', campaignsController.list);
router.post('/campaigns', validateBody(createCampaignBody), campaignsController.create);
router.post('/campaigns/:id/send', campaignsController.send);
router.post('/preview', campaignsController.preview);
router.post('/test-campaign', campaignsController.testCampaign);
router.delete('/campaigns/:id', campaignsController.remove);

module.exports = router;
