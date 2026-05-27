const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Define LogArchive Schema dynamically if not heavily used in app
const LogArchiveSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId },
  timestamp: { type: Date },
  origin: { type: String },
  actorId: { type: String },
  actorRole: { type: String },
  actionType: { type: String },
  targetEntity: { type: String },
  status: { type: String },
  payload: { type: mongoose.Schema.Types.Mixed },
  executionTimeMs: { type: Number },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  targetId: { type: mongoose.Schema.Types.Mixed },
  targetType: { type: String },
  createdAt: { type: Date },
  archivedAt: { type: Date, default: Date.now }
}, { strict: false });

const LogArchive = mongoose.models.LogArchive || mongoose.model('LogArchive', LogArchiveSchema);

const initLogArchiverWorker = () => {
  // Run every Sunday at 02:00
  cron.schedule('0 2 * * 0', async () => {
    logger.info('logArchiverWorker', 'Starting weekly log archival');
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const Log = require('../models/Log');
      
      const oldLogs = await Log.find({ createdAt: { $lt: ninetyDaysAgo } }).lean();
      
      if (oldLogs.length > 0) {
        const archiveDocs = oldLogs.map(log => ({
          ...log,
          originalId: log._id,
          _id: undefined
        }));

        await LogArchive.insertMany(archiveDocs);
        
        // Delete original logs
        const idsToDelete = oldLogs.map(l => l._id);
        await Log.deleteMany({ _id: { $in: idsToDelete } });
        
        logger.info('logArchiverWorker', `Archived ${oldLogs.length} old logs`);
      } else {
        logger.info('logArchiverWorker', 'No logs older than 90 days to archive');
      }

      // Also archive CRMAudit
      const CRMAudit = require('../models/CRMAudit');
      const CRMAuditArchive = mongoose.models.CRMAuditArchive || mongoose.model('CRMAuditArchive', new mongoose.Schema({}, { strict: false }));
      
      const oldAudits = await CRMAudit.find({ timestamp: { $lt: ninetyDaysAgo } }).lean();
      if (oldAudits.length > 0) {
         const auditArchiveDocs = oldAudits.map(audit => ({
          ...audit,
          originalId: audit._id,
          _id: undefined,
          archivedAt: new Date()
        }));

        await CRMAuditArchive.insertMany(auditArchiveDocs);
        await CRMAudit.deleteMany({ _id: { $in: oldAudits.map(a => a._id) } });
        
        logger.info('logArchiverWorker', `Archived ${oldAudits.length} old CRM audits`);
      }

    } catch (err) {
      logger.error('logArchiverWorker', 'Failed to archive logs', { error: err.message || err });
    }
  });

  logger.info('logArchiverWorker', 'Log Archiver cron registered (0 2 * * 0)');
};

module.exports = { initLogArchiverWorker };
