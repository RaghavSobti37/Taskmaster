const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const { listEmailStreamsForApi } = require('../../../../shared/emailStreams.cjs');
const { requireFeatureUnlock } = require('../../../middleware/requireFeatureUnlock');

const router = express.Router();

router.get('/', protect, requireFeatureUnlock('resend'), (_req, res) => {
  res.json(listEmailStreamsForApi());
});

module.exports = router;
