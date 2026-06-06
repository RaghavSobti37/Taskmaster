const OutsourcedRecord = require('../models/OutsourcedRecord');
const BookedCall = require('../models/BookedCall');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const Lead = require('../models/Lead');
const CRMImport = require('../models/CRMImport');
const csv = require('csv-parser');
const fs = require('fs');
const { escapeRegExp, sanitizeEmail, sanitizeName, normalizePhone } = require('../utils/sanitizer');
const { normalizePersonRecord } = require('../utils/personNormalization');
const logger = require('../utils/logger');
const { bulkUpsertClassifiedRows } = require('../services/sourceRecordService');

exports.getTscData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      const escaped = escapeRegExp(search);
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { campaign: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (req.query.campaign && req.query.campaign !== 'all') query.campaign = req.query.campaign;
    if (req.query.originSource && req.query.originSource !== 'all') query.originSource = req.query.originSource;
    if (req.query.role && req.query.role !== 'all') {
      if (req.query.role === 'OTHERS') {
        const musicKeywords = [
          'pop', 'rock', 'indie', 'jazz', 'blues', 'metal', 'hiphop', 'rap', 'singer',
          'musician', 'artist', 'producer', 'composer', 'dj', 'vocalist', 'guitarist',
          'drummer', 'pianist', 'bollywood', 'classical', 'edm', 'techno', 'folk',
          'country', 'soul', 'rnb', 'reggae', 'punk', 'orchestra', 'ballads',
          'romantic', 'alternative', 'acoustic', 'instrumental', 'remix', 'lofi',
        ];
        query.role = { $not: { $regex: musicKeywords.join('|'), $options: 'i' } };
      } else {
        query.role = { $regex: `(^|,)\\s*${req.query.role}\\s*(,|$)`, $options: 'i' };
      }
    }
    if (req.query.emailStatus && req.query.emailStatus !== 'all') query.emailStatus = req.query.emailStatus;
    if (req.query.tag && req.query.tag !== 'all') query.tags = req.query.tag;

    const total = await OutsourcedRecord.countDocuments(query);
    const data = await OutsourcedRecord.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const pipeline = [
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'leads',
          let: { tscEmail: '$email', tscPhone: '$phone' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $ne: ['$email', ''] }, { $eq: ['$email', '$$tscEmail'] }] },
                    { $and: [{ $ne: ['$phone', ''] }, { $eq: ['$phone', '$$tscPhone'] }] },
                  ],
                },
              },
            },
            { $limit: 1 },
            {
              $project: {
                name: 1, email: 1, phone: 1, leadStatus: 1, callStatus: 1, assignedRepId: 1,
              },
            },
          ],
          as: 'leadData',
        },
      },
      {
        $unwind: {
          path: '$leadData',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const finalData = await OutsourcedRecord.aggregate(pipeline);
    res.json({ data: finalData.length ? finalData : data, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error('tscController', 'fetching outsourced data:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch outsourced data' });
  }
};

exports.getTscStats = async (req, res) => {
  try {
    const stats = await OutsourcedRecord.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$emailStatus', count: { $sum: 1 } } }],
          byCampaign: [{ $group: { _id: '$campaign', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }],
        },
      },
    ]);

    const [campaigns, sources, roles] = await Promise.all([
      OutsourcedRecord.distinct('campaign'),
      OutsourcedRecord.distinct('originSource'),
      OutsourcedRecord.distinct('role'),
    ]);

    const uniqueRoles = new Set();
    const otherRoles = new Set();
    const musicKeywords = [
      'pop', 'rock', 'indie', 'jazz', 'blues', 'metal', 'hiphop', 'rap', 'singer',
      'musician', 'artist', 'producer', 'composer', 'dj', 'vocalist', 'guitarist',
      'drummer', 'pianist', 'bollywood', 'classical', 'edm', 'techno', 'folk',
      'country', 'soul', 'rnb', 'reggae', 'punk', 'orchestra', 'ballads',
      'romantic', 'alternative', 'acoustic', 'instrumental', 'remix', 'lofi',
    ];

    roles.forEach((r) => {
      if (r) {
        r.split(',').forEach((part) => {
          const clean = part.trim().toLowerCase();
          const isSingleWord = !clean.includes(' ');
          const hasNoSpecialChars = /^[a-z]+$/.test(clean.replace('-', ''));
          const isMusicRelated = musicKeywords.some((k) => clean.includes(k));
          if (isSingleWord && hasNoSpecialChars && isMusicRelated) {
            uniqueRoles.add(clean.toUpperCase());
          } else if (clean) {
            otherRoles.add(clean);
          }
        });
      }
    });

    const finalRoles = Array.from(uniqueRoles).sort();
    if (otherRoles.size > 0) finalRoles.push('OTHERS');

    res.json({
      summary: stats[0],
      filters: {
        campaigns: campaigns.filter(Boolean),
        sources: sources.filter(Boolean),
        roles: finalRoles,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch outsourced stats' });
  }
};

exports.uploadTscFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const headers = [];
  const sample = [];
  let rowCount = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('headers', (h) => headers.push(...h))
    .on('data', (row) => {
      rowCount++;
      if (sample.length < 5) sample.push(row);
    })
    .on('end', () => {
      res.json({
        headers,
        sample,
        rowCount,
        filename: req.file.originalname,
        tempPath: req.file.path,
      });
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
};

exports.importTscData = async (req, res) => {
  const { mapping, tempPath, filename } = req.body;
  if (!tempPath || !fs.existsSync(tempPath)) {
    return res.status(400).json({ error: 'Temporary file not found' });
  }

  const results = [];
  fs.createReadStream(tempPath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const importSession = await CRMImport.create({
          filename: filename || 'data_import.csv',
          leadCount: results.length,
          createdBy: req.user._id,
        });

        const docs = results.map((row) => {
          const doc = { importId: importSession._id, metadata: {} };
          for (const [csvCol, dbField] of Object.entries(mapping)) {
            const value = row[csvCol];
            if (value === undefined || value === null) continue;
            if (dbField === 'IGNORE') continue;
            if (dbField === 'metadata') {
              doc.metadata[csvCol] = value;
            } else {
              doc[dbField] = value;
            }
          }

          if (!doc.name) doc.name = row.Name || row.name || 'Unknown';
          if (doc.name) doc.name = sanitizeName(doc.name) || doc.name;
          if (doc.email) doc.email = sanitizeEmail(doc.email) || doc.email;
          if (doc.phone) doc.phone = normalizePhone(doc.phone) || doc.phone;

          const normalized = normalizePersonRecord(doc, { tryRepairPhone: true });
          if (normalized.errors.length) return null;
          doc.name = normalized.name;
          doc.nameKey = normalized.nameKey;
          doc.email = normalized.email;
          doc.phone = normalized.phone;
          doc.city = normalized.city;
          if (doc.state && typeof doc.state === 'string') {
            const { sanitizeLocation } = require('../utils/sanitizer');
            doc.state = sanitizeLocation(doc.state);
          }
          return doc;
        }).filter(Boolean);

        const imported = await bulkUpsertClassifiedRows(docs);
        try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
        res.status(201).json({ message: `${imported.length} records classified and processed.`, count: imported.length });
      } catch (error) {
        logger.error('tscController', 'Import ', { error: error.message || error });
        res.status(500).json({ error: 'Failed to import data' });
      }
    });
};

exports.bulkDeleteTscData = async (req, res) => {
  try {
    const { ids, filter, search } = req.body;
    let query = {};

    if (ids && Array.isArray(ids)) {
      query = { _id: { $in: ids } };
    } else if (filter || search) {
      if (search) {
        const escaped = escapeRegExp(search);
        query.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
          { phone: { $regex: escaped, $options: 'i' } },
          { campaign: { $regex: escaped, $options: 'i' } },
        ];
      }
      if (filter) {
        if (filter.campaign && filter.campaign !== 'all') query.campaign = filter.campaign;
        if (filter.originSource && filter.originSource !== 'all') query.originSource = filter.originSource;
      }
    } else {
      return res.status(400).json({ error: 'No deletion criteria provided' });
    }

    const [out, booked, news] = await Promise.all([
      OutsourcedRecord.deleteMany(query),
      BookedCall.deleteMany(query),
      NewsletterSubscriber.deleteMany(query),
    ]);
    const deletedCount = (out.deletedCount || 0) + (booked.deletedCount || 0) + (news.deletedCount || 0);
    res.json({ message: `${deletedCount} records purged successfully.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge data' });
  }
};

exports.deleteTscImport = async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([
      OutsourcedRecord.deleteMany({ importId: id }),
      BookedCall.deleteMany({ importId: id }),
      NewsletterSubscriber.deleteMany({ importId: id }),
    ]);
    await CRMImport.findByIdAndDelete(id);
    res.json({ message: 'Import deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete import' });
  }
};
