const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const { DEFAULT_EMAIL_STREAMS } = require('../../../../shared/emailStreams.cjs');
const { requireFeatureUnlock } = require('../../../middleware/requireFeatureUnlock');

const router = express.Router();

router.get('/', protect, requireFeatureUnlock('resend'), (_req, res) => {
  res.json(DEFAULT_EMAIL_STREAMS);
});

module.exports = router;
