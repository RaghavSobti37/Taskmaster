const express = require('express');

const AUTO_MAILER_URL = process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app';

function movedToAutoMailer(_req, res) {
  res.status(410).json({
    error: 'Moved to Auto-Mailer',
    service: 'auto-mailer',
    url: AUTO_MAILER_URL,
  });
}

const router = express.Router();
router.use(movedToAutoMailer);

module.exports = router;
