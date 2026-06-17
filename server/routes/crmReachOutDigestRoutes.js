const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { validateBody } = require('../validation/validateBody');
const { sendCrmReachOutDigestBody } = require('../validation/schemas/admin');
const { runCrmReachOutDigest } = require('../services/crmReachOutDigestService');
const logger = require('../utils/logger');

const router = express.Router();
const scriptsAccess = requirePageAccess('admin_scripts');

router.use(protect, scriptsAccess);

router.post('/send', validateBody(sendCrmReachOutDigestBody), async (req, res) => {
  try {
    const { to, days = 1, dryRun = false } = req.body || {};
    const lookbackDays = days;
    const testMode = Boolean(to);

    const result = await runCrmReachOutDigest({
      lookbackDays,
      recipient: to,
      testMode,
      dryRun,
      forceSend: true,
      skipLock: testMode,
    });

    logger.info('CrmReachOutDigest', 'Admin digest trigger', {
      actor: req.user?._id,
      lookbackDays,
      to: to || '(default)',
      dryRun,
      sent: result.sent,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('CrmReachOutDigest', 'Admin digest trigger failed', { error: error.message });
    res.status(500).json({ success: false, message: error.message || 'Digest send failed' });
  }
});

module.exports = router;
