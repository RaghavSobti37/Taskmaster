const cron = require('node-cron');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CRMStatSnapshot = require('../models/CRMStatSnapshot');
const logger = require('../utils/logger');

const { warmPipelineQuery } = require('../utils/crmPipelineFilters');

const calculateStats = async (matchStage) => {
  const stats = await Lead.aggregate([
    { $match: matchStage },
    {
      $facet: {
        total: [{ $count: "count" }],
        connected: [
          { $match: { callStatus: 'Connected' } },
          { $count: "count" }
        ],
        meaningful: [
          { $match: { meaningfulConnect: 'YES' } },
          { $count: "count" }
        ],
        warmLeads: [
          { $match: warmPipelineQuery() },
          { $count: "count" }
        ],
        converted: [
          { $match: { leadStatus: 'Converted' } },
          { $count: "count" }
        ],
        totalReps: [
          { $group: { _id: "$assignedRepId" } },
          { $match: { _id: { $ne: null } } },
          { $count: "count" }
        ]
      }
    }
  ]);

  const result = stats[0];
  const totalLeads = result.total[0]?.count || 0;
  const convertedLeads = result.converted[0]?.count || 0;
  const warmLeads = result.warmLeads[0]?.count || 0;
  const activeReach = result.meaningful[0]?.count || 0;
  const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

  return {
    totalLeads,
    // Keep both legacy + new keys so snapshot reads stay stable.
    activeReach,
    meaningful: activeReach,
    convertedLeads,
    converted: convertedLeads,
    warmLeads,
    conversionRate,
    connected: result.connected[0]?.count || 0,
    totalReps: result.totalReps[0]?.count || 0
  };
};

const updateStats = async () => {
  try {
    const startTime = Date.now();
    logger.info('statsWorker', 'Starting CRM stats snapshot job');
    
    // 1. Calculate Global Stats
    const globalStats = await calculateStats({});
    
    // 2. Identify active Reps
    const activeReps = await Lead.distinct('assignedRepId', { assignedRepId: { $ne: null } });
    
    const bulkOps = [];
    
    // Global Upsert
    bulkOps.push({
      updateOne: {
        filter: { repId: null },
        update: { $set: { metrics: globalStats, updatedAt: new Date() } },
        upsert: true
      }
    });

    // 3. Calculate Per-Rep Stats
    for (const repId of activeReps) {
      if (!mongoose.Types.ObjectId.isValid(repId)) continue;
      const repStats = await calculateStats({ assignedRepId: new mongoose.Types.ObjectId(repId) });
      
      bulkOps.push({
        updateOne: {
          filter: { repId },
          update: { $set: { metrics: repStats, updatedAt: new Date() } },
          upsert: true
        }
      });
    }

    // Execute zero-downtime bulk write
    if (bulkOps.length > 0) {
      await CRMStatSnapshot.bulkWrite(bulkOps);
      try {
        const { isSupabaseEnabled } = require('../config/supabase');
        const { mirrorCrmStatSnapshotsFromMongo } = require('../services/supabase/snapshotStore');
        if (isSupabaseEnabled()) {
          const snapshots = await CRMStatSnapshot.find({}).lean();
          await mirrorCrmStatSnapshotsFromMongo(snapshots);
        }
      } catch (mirrorErr) {
        logger.warn('statsWorker', 'Supabase CRM snapshot mirror failed', { error: mirrorErr.message });
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info('statsWorker', `Completed CRM stats snapshot job in ${duration}ms for ${activeReps.length + 1} entities`);
  } catch (err) {
    logger.error('statsWorker', 'Stats aggregation failed', { error: err.message || err });
  }
};

// Initialize Worker
const initWorker = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', updateStats);
  logger.info('statsWorker', 'Scheduled node-cron for CRM Stat Snapshots (every 5 mins)');
  
  setTimeout(updateStats, 5000);
};

module.exports = { initWorker, updateStats, calculateStats };
