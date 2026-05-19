/**
 * Concurrency Guardrail Middleware
 * Protects documents from simultaneous edits by checking lockedBy and lockedAt fields.
 */
const checkLock = (Model) => async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.body.userId; // Current user
    if (!userId) return next();

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Attempt to claim or renew lock atomically
    const lockedLead = await Model.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { lockedBy: { $exists: false } },
          { lockedBy: null },
          { lockedBy: userId.toString() },
          { lockedAt: { $lt: fifteenMinutesAgo } }
        ]
      },
      {
        $set: { lockedBy: userId.toString(), lockedAt: new Date() }
      },
      { new: true }
    );

    if (!lockedLead) {
      return res.status(423).json({
        error: 'Record Locked',
        message: 'This lead is currently being edited by another representative.'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkLock };
