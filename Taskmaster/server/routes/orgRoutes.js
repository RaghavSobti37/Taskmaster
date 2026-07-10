const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { getOrgContextBySlug } = require('../services/orgContextService');

const router = express.Router();

router.get(
  '/:slug/context',
  protect,
  asyncHandler(async (req, res) => {
    const includeAllMemberships = String(req.query.includeAllMemberships || '') === '1';
    const context = await getOrgContextBySlug({
      user: req.user,
      slug: req.params.slug,
      req,
      res,
      includeAllMemberships,
      syncSession: true,
    });
    res.json(context);
  }),
);

module.exports = router;
