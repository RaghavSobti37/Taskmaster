const Lead = require('../models/Lead');
const { broadcastRealtimeEvent } = require('../../../config/realtime');

const LOCK_HEARTBEAT_MS = 60 * 1000;

async function releaseLeadLock(leadId, userId) {
  const lead = await Lead.findById(leadId).select('lockedBy').lean();
  if (!lead) return { error: 'Lead not found', status: 404 };
  if (lead.lockedBy && lead.lockedBy !== userId) {
    return { error: 'Lock held by another user', status: 409 };
  }
  await Lead.findByIdAndUpdate(leadId, { $unset: { lockedBy: 1, lockedAt: 1 } });
  broadcastRealtimeEvent('leads', 'lead_unlock', { leadId });
  return { success: true };
}

async function heartbeatLeadLock(leadId, userId) {
  const lockDuration = new Date(Date.now() - LOCK_HEARTBEAT_MS);
  const lead = await Lead.findOneAndUpdate(
    {
      _id: leadId,
      lockedBy: userId,
      lockedAt: { $gte: lockDuration },
    },
    { $set: { lockedAt: new Date() } },
    { returnDocument: 'after' },
  ).select('lockedBy lockedAt');
  if (!lead) {
    return { error: 'Lock not held or expired', status: 409 };
  }
  return { success: true, lockedAt: lead.lockedAt };
}

module.exports = {
  LOCK_HEARTBEAT_MS,
  releaseLeadLock,
  heartbeatLeadLock,
};
