const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { approveMasterclassReview } = require('../services/masterclassReviewService');

const router = express.Router();

router.patch('/masterclass-reviews/:id/approve', protect, admin, async (req, res) => {
  try {
    const review = await approveMasterclassReview(req.params.id);
    return res.json({ success: true, reviewId: review._id, isApproved: review.isApproved });
  } catch (err) {
    const status = err.message === 'Review not found' ? 404 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
