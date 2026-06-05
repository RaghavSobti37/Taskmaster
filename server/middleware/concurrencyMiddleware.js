/**
 * Concurrency Guardrail Middleware
 * Protects documents from simultaneous edits by checking lockedBy and lockedAt fields.
 */
const User = require('../models/User');
const { broadcastRealtimeEvent } = require('../config/realtime');

const checkLock = (Model) => async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.body.userId;
    if (!userId) return next();

    const lockDuration = new Date(Date.now() - 60 * 1000);

    const lockedLead = await Model.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { lockedBy: { $exists: false } },
          { lockedBy: null },
          { lockedBy: userId.toString() },
          { lockedAt: { $lt: lockDuration } },
        ],
      },
      {
        $set: { lockedBy: userId.toString(), lockedAt: new Date() },
      },
      { new: true }
    );

    if (!lockedLead) {
      const existing = await Model.findById(id).select('lockedBy').lean();
      let lockedByUser = null;
      if (existing?.lockedBy) {
        const holder = await User.findById(existing.lockedBy).select('name').lean();
        lockedByUser = {
          id: existing.lockedBy,
          name: holder?.name || 'Another user',
        };
      }

      return res.status(423).json({
        error: 'Record Locked',
        message: lockedByUser
          ? `This lead is currently being edited by ${lockedByUser.name}.`
          : 'This lead is currently being edited by another representative.',
        lockedBy: existing?.lockedBy || null,
        lockedByUser,
      });
    }

    broadcastRealtimeEvent('leads', 'lead_lock', {
      leadId: id,
      lockedBy: userId.toString(),
      lockedAt: new Date().toISOString(),
    });

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkLock };
