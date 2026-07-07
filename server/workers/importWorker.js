const { Queue, Worker } = require('bullmq');
const { createRedisClient, ensureRedisReady, isRedisReady } = require('../utils/wslRedis');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Department = require('../models/Department');
const CRMImport = require('../models/CRMImport');
const { SALES_SLUG } = require('../utils/departmentPermissions');
const logger = require('../utils/logger');
const { normalizePersonRecord } = require('../utils/personNormalization');

const QUEUE_NAME = 'CsvImportQueue';
const connection = createRedisClient();
let bullQueue = null;
let workerInstance = null;
let workerStartPromise = null;

function getBullQueue() {
  if (!bullQueue) {
    bullQueue = new Queue(QUEUE_NAME, { connection });
    bullQueue.on('error', () => {});
  }
  return bullQueue;
}

async function ensureImportQueue() {
  if (!(await ensureRedisReady(connection))) {
    throw new Error('Redis unavailable');
  }
  return getBullQueue();
}

const importQueue = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'then') return undefined;
    return async (...args) => {
      const queue = await ensureImportQueue();
      const value = queue[prop];
      if (typeof value !== 'function') return value;
      return value.apply(queue, args);
    };
  },
});

const initImportWorker = () => {
  if (workerInstance) return workerInstance;
  if (!isRedisReady(connection)) {
    if (!workerStartPromise) {
      workerStartPromise = ensureRedisReady(connection).then((ready) => {
        workerStartPromise = null;
        return ready ? initImportWorker() : null;
      });
    }
    logger.debug('importWorker', 'Deferred - Redis not ready');
    return null;
  }

  getBullQueue();
  workerInstance = new Worker(QUEUE_NAME, async job => {
    const { filePath, originalname, userId, mapping } = job.data;
    logger.info('importWorker', `Starting CSV import job ${job.id} for file ${originalname}`);

    try {
      const salesDept = await Department.findOne({ slug: SALES_SLUG }).select('_id');
      const repFilter = salesDept ? { departmentId: salesDept._id } : { _id: null };
      const reps = await User.find(repFilter).select('_id name');
      const repMap = {};
      reps.forEach(r => {
        if (r.name) repMap[r.name.toLowerCase().trim()] = r._id;
      });

      const importSession = await CRMImport.create({
        filename: originalname,
        leadCount: 0,
        createdBy: userId
      });

      let totalProcessed = 0;
      let batch = [];
      const BATCH_SIZE = 500;
      let repIndex = 0;

      const ALLOWED_LEAD_FIELDS = [
        'name', 'email', 'phone', 'city', 'webinarDates', 'attended', 'attendanceDurationMin',
        'meaningfulConnect', 'leadQuality', 'callStatus', 'leadStatus', 'remarks',
        'planOption', 'assignedRepId', 'rowId', 'customerIdExly', 'transactionIdExly',
        'exlyOfferingId', 'exlyOfferingTitle',
        'qnaAnswered', 'artistType', 'fullTimeWillingness', 'primaryRole',
        'learningGoal', 'learnedMusic', 'currentJourney', 'nextFollowupDate', 'nextFollowupTime',
        'emailStatus', 'tags', 'source', 'notes', 'setReminder'
      ];

      const processBatch = async (rows) => {
        const leadDocs = [];
        let skippedRows = 0;
        for (const row of rows) {
          const rawRepName = (row.assigned_rep_id || row.Assigned_Rep_Id || '').toLowerCase().trim();
          let assignedRepId = null;

          if (rawRepName) {
            const matchedKey = Object.keys(repMap).find(key => rawRepName.includes(key));
            if (matchedKey) assignedRepId = repMap[matchedKey];
          }

          if (!assignedRepId && reps.length > 0) {
            assignedRepId = reps[repIndex % reps.length]._id;
            repIndex++;
          }

          const leadDoc = {
            assignedRepId,
            createdBy: userId,
            leadStatus: 'New',
            callStatus: 'Pending',
            metadata: {}
          };

          for (const [csvCol, dbField] of Object.entries(mapping)) {
            const value = row[csvCol];
            if (!value || dbField === 'IGNORE') continue;

            if (dbField === 'metadata') leadDoc.metadata[csvCol] = value;
            else if (ALLOWED_LEAD_FIELDS.includes(dbField)) leadDoc[dbField] = value;
            else leadDoc.metadata[dbField || csvCol] = value;
          }

          if (!leadDoc.name) leadDoc.name = row.name || row.Name || row['Full Name'] || 'Unknown';
          if (!leadDoc.phone) leadDoc.phone = row.phone || row.Phone || row['Mobile Number'] || '';
          if (!leadDoc.email) leadDoc.email = row.email || row.Email || '';
          if (!leadDoc.city) leadDoc.city = row.city || row.City || row.location || row.Location || '';

          const normalized = normalizePersonRecord(leadDoc, {
            requireName: true,
            requirePhone: true,
            tryRepairPhone: true,
          });
          if (normalized.errors.length) {
            skippedRows += 1;
            logger.warn('importWorker', `Skipped row: ${normalized.errors[0]}`, {
              name: leadDoc.name,
              email: leadDoc.email,
            });
            continue;
          }
          leadDoc.name = normalized.name;
          leadDoc.nameKey = normalized.nameKey;
          leadDoc.email = normalized.email;
          leadDoc.phone = normalized.phone;
          leadDoc.city = normalized.city;

          leadDocs.push(leadDoc);
        }

        const bulkOps = leadDocs.map(doc => {
          const filter = { $or: [] };
          if (doc.rowId) filter.$or.push({ rowId: doc.rowId });
          if (doc.phone) filter.$or.push({ phone: doc.phone });
          if (doc.email) filter.$or.push({ email: doc.email.toLowerCase() });

          if (filter.$or.length === 0) return { insertOne: { document: { ...doc, importId: importSession._id } } };
          return { updateOne: { filter, update: { $set: { ...doc, importId: importSession._id } }, upsert: true } };
        });

        if (bulkOps.length > 0) await Lead.bulkWrite(bulkOps);
        totalProcessed += leadDocs.length;
      };

      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath).pipe(csv());
        stream.on('data', async (data) => {
          batch.push(data);
          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            const rowsToProcess = [...batch];
            batch = [];
            try {
              await processBatch(rowsToProcess);
              stream.resume();
            } catch (err) {
              logger.error('importWorker', 'Batch err', { err });
              reject(err);
            }
          }
        });

        stream.on('end', async () => {
          if (batch.length > 0) {
            try {
              await processBatch(batch);
            } catch (err) {
              logger.error('importWorker', 'Final batch err', { err });
              return reject(err);
            }
          }
          await CRMImport.findByIdAndUpdate(importSession._id, { leadCount: totalProcessed });
          try { fs.unlinkSync(filePath); } catch (e) { }
          resolve(totalProcessed);
        });
        
        stream.on('error', (err) => {
          try { fs.unlinkSync(filePath); } catch (e) { }
          reject(err);
        });
      });
    } catch (err) {
      try { fs.unlinkSync(filePath); } catch (e) { }
      throw err;
    }
  }, { connection });

  workerInstance.on('completed', (job, result) => logger.info('importWorker', `Job ${job.id} completed. Processed ${result} leads.`));
  workerInstance.on('failed', (job, err) => logger.error('importWorker', `Job ${job.id} failed: ${err.message}`));
  workerInstance.on('error', () => {});
  
  logger.debug('importWorker', 'CSV Import worker initialized');
  return workerInstance;
};

module.exports = { initImportWorker, importQueue };
