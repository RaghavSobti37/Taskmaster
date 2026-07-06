const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../../middleware/authMiddleware');
const { validateBody } = require('../../../validation/validateBody');
const { mailProfileBody, updateMailProfileBody } = require('../../../validation/schemas/mail');
const profilesController = require('../controllers/profilesController');
const { requireFeatureUnlock } = require('../../../middleware/requireFeatureUnlock');

const emailsAccess = requirePageAccess('emails');

router.use(protect, emailsAccess, requireFeatureUnlock('resend'));

router.get('/smtp-usage', profilesController.getSmtpUsage);
router.get('/profiles', profilesController.list);
router.post('/profiles', validateBody(mailProfileBody), profilesController.create);
router.delete('/profiles/:id', profilesController.remove);
router.put('/profiles/:id', validateBody(updateMailProfileBody), profilesController.update);

module.exports = router;
