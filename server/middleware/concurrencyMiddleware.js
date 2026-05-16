/**
 * Concurrency Guardrail Middleware
 * Protects documents from simultaneous edits by checking lockedBy and lockedAt fields.
 */
const checkLock = (Model) => async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.body.userId; // Current user

    const doc = await Model.findById(id);
    if (!doc) return next();

    // If locked by someone else and lock is fresh (less than 15 mins)
    const LOCK_EXPIRY_MS = 15 * 60 * 1000;
    const isLocked = doc.lockedBy && 
                     doc.lockedBy !== userId && 
                     (new Date() - new Date(doc.lockedAt)) < LOCK_EXPIRY_MS;

    if (isLocked) {
      return res.status(423).json({
        error: 'Record Locked',
        message: 'This record is currently being edited by another user.',
        lockedBy: doc.lockedBy,
        lockedAt: doc.lockedAt
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkLock };
