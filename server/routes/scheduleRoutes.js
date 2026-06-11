const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { getScheduleForUser } = require('../services/scheduleService');
const { validateQuery } = require('../validation/validateQuery');
const { scheduleQuery } = require('../validation/schemas/schedule');

const schedulePage = requirePageAccess('schedule');

router.use(protect);
router.use(schedulePage);

router.get('/', validateQuery(scheduleQuery), async (req, res) => {
  try {
    const { start, end, projectId, departmentId } = req.query;
    const payload = await getScheduleForUser({
      user: req.user,
      userId: req.user._id,
      start,
      end,
      projectId,
      departmentId,
    });
    res.json(payload);
  } catch (err) {
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Project not found' });
    }
    console.error('[schedule] GET /', err);
    res.status(500).json({ error: 'Failed to load schedule' });
  }
});

module.exports = router;
