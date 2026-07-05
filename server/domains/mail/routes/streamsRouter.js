const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const { DEFAULT_EMAIL_STREAMS } = require('../../../../shared/emailStreams.cjs');

const router = express.Router();

router.get('/', protect, (_req, res) => {
  res.json({ streams: DEFAULT_EMAIL_STREAMS });
});

module.exports = router;
