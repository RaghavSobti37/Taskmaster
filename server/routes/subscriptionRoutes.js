const express = require('express');
const router = express.Router();
const { protect, opsOrAdmin } = require('../middleware/authMiddleware');
const {
  getUsdInrRate,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} = require('../controllers/subscriptionController');

router.use(protect);

router.get('/usd-inr-rate', getUsdInrRate);
router.get('/', opsOrAdmin, listSubscriptions);
router.post('/', opsOrAdmin, createSubscription);
router.put('/:id', opsOrAdmin, updateSubscription);
router.delete('/:id', opsOrAdmin, deleteSubscription);

module.exports = router;
