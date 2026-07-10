const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { getAdminConsoleSummary } = require('../services/adminConsoleService');

const router = express.Router();
const consoleAccess = requirePageAccess('admin_console');

router.get(
  '/summary',
  protect,
  consoleAccess,
  asyncHandler(async (req, res) => {
    const summary = await getAdminConsoleSummary(req);
    if (summary.error) {
      return res.status(403).json({ error: summary.error });
    }
    res.json(summary);
  }),
);

module.exports = router;
