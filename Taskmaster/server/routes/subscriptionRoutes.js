const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const subscriptionsAccess = requirePageAccess('subscriptions');
const {
  getUsdInrRate,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} = require('../controllers/subscriptionController');

router.use(protect);

router.get('/usd-inr-rate', getUsdInrRate);
router.get('/', subscriptionsAccess, listSubscriptions);
router.post('/', subscriptionsAccess, createSubscription);
router.put('/:id', subscriptionsAccess, updateSubscription);
router.delete('/:id', subscriptionsAccess, deleteSubscription);

module.exports = router;
