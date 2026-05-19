const Redis = require('ioredis');
const path = require('path');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisConnection = null;
let redisAvailable = false;

try {
  redisConnection = new Redis(redisUrl, {
    connectTimeout: 2000,
    lazyConnect: true
  });
  
  redisConnection.connect()
    .then(() => {
      console.log('[Followup Cache] Redis connected successfully.');
      redisAvailable = true;
    })
    .catch((err) => {
      console.warn('[Followup Cache Warning] Redis connection failed, bypassing cache layer:', err.message);
      redisAvailable = false;
    });

  redisConnection.on('error', (err) => {
    if (redisAvailable) {
      console.warn('[Followup Cache Warning] Redis disconnected.');
      redisAvailable = false;
    }
  });
} catch (err) {
  console.warn('[Followup Cache Exception] Initialization failed:', err.message);
  redisAvailable = false;
}

/**
 * Cache a lead's follow-up schedule object in Redis.
 * Handles ZSET addition and key removal.
 */
async function cacheFollowup(lead) {
  if (!redisAvailable || !redisConnection) return;
  try {
    const leadId = String(lead._id);
    const repId = lead.assignedRepId ? String(lead.assignedRepId) : 'unassigned';
    const keyRep = `followups:rep:${repId}`;
    const keyGlobal = 'followups:global';

    // Check if the follow-up is completed
    const isCompleted = lead.callStatus === 'Connected' || lead.leadStatus === 'Converted';
    
    if (!lead.nextFollowupDate || isCompleted) {
      await Promise.all([
        redisConnection.zrem(keyRep, leadId),
        redisConnection.zrem(keyGlobal, leadId),
        redisConnection.del(`followup:details:${leadId}`)
      ]);
      return;
    }

    // Parse date and time into a score (timestamp)
    const dateStr = lead.nextFollowupDate;
    const timeStr = lead.nextFollowupTime || '00:00';
    const score = new Date(`${dateStr}T${timeStr}:00`).getTime() || Date.now();

    const memberObj = {
      _id: leadId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      callStatus: lead.callStatus,
      leadStatus: lead.leadStatus,
      nextFollowupDate: lead.nextFollowupDate,
      nextFollowupTime: lead.nextFollowupTime,
      assignedRepId: lead.assignedRepId
    };

    await redisConnection.hset(`followup:details:${leadId}`, {
      data: JSON.stringify(memberObj)
    });

    await Promise.all([
      redisConnection.zadd(keyRep, score, leadId),
      redisConnection.zadd(keyGlobal, score, leadId)
    ]);
  } catch (err) {
    console.error('[Followup Cache Error] Failed to write cache:', err.message);
  }
}

/**
 * Retrieve sorted follow-ups from Redis ZSET.
 * Falls back to returning null to trigger database query.
 */
async function getFollowups(repId = null) {
  if (!redisAvailable || !redisConnection) return null;
  try {
    const key = repId ? `followups:rep:${repId}` : 'followups:global';
    const leadIds = await redisConnection.zrange(key, 0, -1);
    
    if (leadIds.length === 0) return [];

    const followups = [];
    for (const leadId of leadIds) {
      const cached = await redisConnection.hget(`followup:details:${leadId}`, 'data');
      if (cached) {
        const parsed = JSON.parse(cached);
        followups.push({
          ...parsed,
          date: parsed.nextFollowupDate,
          time: parsed.nextFollowupTime,
          status: parsed.callStatus === 'Connected' || parsed.leadStatus === 'Converted' ? 'Completed' : 'Pending',
          assignedRep: parsed.assignedRepId
        });
      }
    }
    return followups;
  } catch (err) {
    console.warn('[Followup Cache Error] Read failed, falling back to database query:', err.message);
    return null;
  }
}

/**
 * Explicitly evict follow-up details on document removal.
 */
async function removeFollowup(leadId) {
  if (!redisAvailable || !redisConnection) return;
  try {
    const idStr = String(leadId);
    const cached = await redisConnection.hget(`followup:details:${idStr}`, 'data');
    if (cached) {
      const parsed = JSON.parse(cached);
      const repId = parsed.assignedRepId ? String(parsed.assignedRepId) : 'unassigned';
      await Promise.all([
        redisConnection.zrem(`followups:rep:${repId}`, idStr),
        redisConnection.zrem('followups:global', idStr),
        redisConnection.del(`followup:details:${idStr}`)
      ]);
    }
  } catch (err) {}
}

module.exports = {
  cacheFollowup,
  getFollowups,
  removeFollowup
};
