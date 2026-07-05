const express = require('express');
const router = express.Router();

router.use(require('./templatesRouter'));
router.use(require('./profilesRouter'));
router.use(require('./campaignsRouter'));
router.use(require('./analyticsRouter'));
router.use(require('./holysheetRouter'));
router.use(require('./streamsRouter'));

module.exports = router;
