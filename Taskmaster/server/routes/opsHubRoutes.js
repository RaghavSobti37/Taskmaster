const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/opsHubController');

const opsHubAccess = (req, res, next) => {
  if (ctrl.hasOpsReadAccess(req.user)) return next();
  return res.status(403).json({ error: 'Forbidden' });
};

router.use(protect);
router.use(opsHubAccess);

router.get('/taxonomy', ctrl.getTaxonomy);
router.get('/entities', ctrl.listEntities);
router.get('/entities/:id', ctrl.getEntity);
router.post('/entities', ctrl.createEntity);
router.patch('/entities/:id', ctrl.updateEntity);
router.get('/weekly', ctrl.getWeekly);
router.post('/weekly/submit', ctrl.submitWeekly);
router.get('/analytics', ctrl.getAnalytics);

module.exports = router;
