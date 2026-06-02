const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getScheduleForUser } = require('../services/scheduleService');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { start, end, projectId, departmentId } = req.query;
    const payload = await getScheduleForUser({
      userId: req.user._id,
      start,
      end,
      projectId,
      departmentId,
    });
    res.json(payload);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Project not found' });
    }
    console.error('[schedule] GET /', err);
    res.status(500).json({ error: 'Failed to load schedule' });
  }
});

module.exports = router;
