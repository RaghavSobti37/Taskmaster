const express = require('express');
const router = express.Router();
const { protect, opsOrAdmin } = require('../middleware/authMiddleware');
const {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} = require('../controllers/subscriptionController');

router.use(protect);

router.get('/', listSubscriptions);
router.post('/', createSubscription);
router.put('/:id', updateSubscription);
router.delete('/:id', opsOrAdmin, deleteSubscription);

module.exports = router;
