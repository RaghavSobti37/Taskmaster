const express = require('express');
const { protect, optionalAuthenticate } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const {
  getInviteByToken,
  acceptInvite,
  selectTenant,
} = require('../services/tenantMembershipService');

const router = express.Router();

router.get(
  '/:token',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const invite = await getInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite invalid or expired' });
    res.json({
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      tenant: invite.tenantId && typeof invite.tenantId === 'object'
        ? { _id: invite.tenantId._id, name: invite.tenantId.name }
        : { _id: invite.tenantId },
    });
  }),
);

router.post(
  '/:token/accept',
  protect,
  asyncHandler(async (req, res) => {
    const tenantId = await acceptInvite(req.params.token, req.user._id);
    await selectTenant(req, res, req.user._id, tenantId);
    res.json({ success: true, tenantId: String(tenantId) });
  }),
);

module.exports = router;
