const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const CRMImport = require('../models/CRMImport');
const logger = require('../utils/logger');
const { sanitizeName, sanitizeEmail, normalizePhone, sanitizeLocation } = require('../utils/sanitizer');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  }
});

connection.on('error', () => {});

const importQueue = new Queue('CsvImportQueue', { connection });
importQueue.on('error', () => {});

const initImportWorker = () => {
  const worker = new Worker('CsvImportQueue', async job => {
    const { filePath, originalname, userId, mapping } = job.data;
    logger.info('importWorker', `Starting CSV import job ${job.id} for file ${originalname}`);

    try {
      const reps = await User.find({ role: 'sales' });
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
          if (!leadDoc.phone) leadDoc.phone = row.phone || row.Phone || row['Mobile Number'] || '0000000000';
          if (!leadDoc.email) leadDoc.email = row.email || row.Email || '';
          if (!leadDoc.city) leadDoc.city = row.city || row.City || row.location || row.Location || '';

          leadDoc.name = sanitizeName(leadDoc.name);
          leadDoc.email = sanitizeEmail(leadDoc.email);
          leadDoc.phone = normalizePhone(leadDoc.phone);
          leadDoc.city = sanitizeLocation(leadDoc.city);

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

  worker.on('completed', (job, result) => logger.info('importWorker', `Job ${job.id} completed. Processed ${result} leads.`));
  worker.on('failed', (job, err) => logger.error('importWorker', `Job ${job.id} failed: ${err.message}`));
  worker.on('error', (err) => {});
  
  logger.info('importWorker', 'CSV Import worker initialized');
};

module.exports = { initImportWorker, importQueue };
