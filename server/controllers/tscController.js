const TscData = require('../models/TscData');
const Lead = require('../models/Lead');
const CRMImport = require('../models/CRMImport');
const csv = require('csv-parser');
const fs = require('fs');
const { sanitizeName, sanitizeEmail, normalizePhone, sanitizeLocation } = require('../utils/sanitizer');

exports.getTscData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { campaign: { $regex: escaped, $options: 'i' } }
      ];
    }

    // Dynamic Filters
    if (req.query.campaign && req.query.campaign !== 'all') query.campaign = req.query.campaign;
    if (req.query.originSource && req.query.originSource !== 'all') query.originSource = req.query.originSource;
    if (req.query.role && req.query.role !== 'all') {
      if (req.query.role === 'OTHERS') {
        const musicKeywords = [
          'pop', 'rock', 'indie', 'jazz', 'blues', 'metal', 'hiphop', 'rap', 'singer', 
          'musician', 'artist', 'producer', 'composer', 'dj', 'vocalist', 'guitarist', 
          'drummer', 'pianist', 'bollywood', 'classical', 'edm', 'techno', 'folk', 
          'country', 'soul', 'rnb', 'reggae', 'punk', 'orchestra', 'ballads', 
          'romantic', 'alternative', 'acoustic', 'instrumental', 'remix', 'lofi'
        ];
        // Match everything that isn't a simple music keyword match
        query.role = { $not: { $regex: musicKeywords.join('|'), $options: 'i' } };
      } else {
        // Handle comma separated roles in DB
        query.role = { $regex: `(^|,)\\s*${req.query.role}\\s*(,|$)`, $options: 'i' };
      }
    }
    if (req.query.emailStatus && req.query.emailStatus !== 'all') query.emailStatus = req.query.emailStatus;
    if (req.query.tag && req.query.tag !== 'all') query.tags = req.query.tag;

    const total = await TscData.countDocuments(query);
    const data = await TscData.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Aggregation pipeline for dynamic linking
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
                    { $and: [{ $ne: ['$phone', ''] }, { $eq: ['$phone', '$$tscPhone'] }] }
                  ]
                }
              }
            },
            { $limit: 1 },
            {
              $project: {
                name: 1, email: 1, phone: 1, leadStatus: 1, callStatus: 1, assignedRepId: 1
              }
            }
          ],
          as: 'leadData'
        }
      },
      {
        $unwind: {
          path: '$leadData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'leadData.assignedRepId',
          foreignField: '_id',
          as: 'leadData.assignedRep'
        }
      },
      {
        $unwind: {
          path: '$leadData.assignedRep',
          preserveNullAndEmptyArrays: true
        }
      }
    ];

    // Filter by sync status if requested
    if (req.query.syncStatus === 'synced') {
      pipeline.push({ $match: { leadData: { $exists: true } } });
    } else if (req.query.syncStatus === 'unsynced') {
      pipeline.push({ $match: { leadData: { $exists: false } } });
    }

    const finalData = await TscData.aggregate(pipeline);

    res.json({
      data: finalData,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching TscData:', error);
    res.status(500).json({ error: 'Failed to fetch TSC data' });
  }
};

exports.getTscStats = async (req, res) => {
  try {
    const stats = await TscData.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          campaigns: [
            { $group: { _id: "$campaign", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          sources: [
            { $group: { _id: "$originSource", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          roles: [
            { $group: { _id: "$role", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]);

    // Distinct values for filters
    const [campaigns, sources, roles] = await Promise.all([
      TscData.distinct('campaign'),
      TscData.distinct('originSource'),
      TscData.distinct('role')
    ]);

    // Process roles to split by comma and deduplicate
    const uniqueRoles = new Set();
    const otherRoles = new Set();
    
    const musicKeywords = [
      'pop', 'rock', 'indie', 'jazz', 'blues', 'metal', 'hiphop', 'rap', 'singer', 
      'musician', 'artist', 'producer', 'composer', 'dj', 'vocalist', 'guitarist', 
      'drummer', 'pianist', 'bollywood', 'classical', 'edm', 'techno', 'folk', 
      'country', 'soul', 'rnb', 'reggae', 'punk', 'orchestra', 'ballads', 
      'romantic', 'alternative', 'acoustic', 'instrumental', 'remix', 'lofi'
    ];

    roles.forEach(r => {
      if (r) {
        r.split(',').forEach(part => {
          const clean = part.trim().toLowerCase();
          
          // Validation: No special chars, mostly one word, must be in music keywords
          // We allow some flexibility but strip sentences and junk
          const isSingleWord = !clean.includes(' ');
          const hasNoSpecialChars = /^[a-z]+$/.test(clean.replace('-', ''));
          const isMusicRelated = musicKeywords.some(k => clean.includes(k));

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
        roles: finalRoles
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch TSC stats' });
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
        tempPath: req.file.path 
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
          filename: filename || 'tsc_import.csv',
          leadCount: results.length,
          createdBy: req.user._id
        });

        const tscDocs = results.map(row => {
          const doc = {
            importId: importSession._id,
            metadata: {}
          };

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
          
          // Apply sanitization
          doc.name = sanitizeName(doc.name);
          doc.email = sanitizeEmail(doc.email);
          doc.phone = normalizePhone(doc.phone);
          doc.city = sanitizeLocation(doc.city);
          doc.state = sanitizeLocation(doc.state);

          return doc;
        });

        const bulkOps = tscDocs.map(doc => {
          const filter = { $or: [] };
          if (doc.email) filter.$or.push({ email: doc.email.toLowerCase() });
          if (doc.phone) filter.$or.push({ phone: doc.phone });

          if (filter.$or.length === 0) {
            return { insertOne: { document: doc } };
          }

          return {
            updateOne: {
              filter,
              update: { $set: doc },
              upsert: true
            }
          };
        });

        await TscData.bulkWrite(bulkOps);
        try { fs.unlinkSync(tempPath); } catch(e) {}
        res.status(201).json({ message: `${tscDocs.length} records processed.` });
      } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import TSC data' });
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
        const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
          { phone: { $regex: escaped, $options: 'i' } },
          { campaign: { $regex: escaped, $options: 'i' } }
        ];
      }
      if (filter) {
        if (filter.campaign && filter.campaign !== 'all') query.campaign = filter.campaign;
        if (filter.originSource && filter.originSource !== 'all') query.originSource = filter.originSource;
        if (filter.role && filter.role !== 'all') {
          if (filter.role === 'OTHERS') {
            const musicKeywords = [
              'pop', 'rock', 'indie', 'jazz', 'blues', 'metal', 'hiphop', 'rap', 'singer', 
              'musician', 'artist', 'producer', 'composer', 'dj', 'vocalist', 'guitarist', 
              'drummer', 'pianist', 'bollywood', 'classical', 'edm', 'techno', 'folk', 
              'country', 'soul', 'rnb', 'reggae', 'punk', 'orchestra', 'ballads', 
              'romantic', 'alternative', 'acoustic', 'instrumental', 'remix', 'lofi'
            ];
            query.role = { $not: { $regex: musicKeywords.join('|'), $options: 'i' } };
          } else {
            query.role = { $regex: `(^|,)\\s*${filter.role}\\s*(,|$)`, $options: 'i' };
          }
        }
      }
    } else {
      return res.status(400).json({ error: 'No deletion criteria provided' });
    }

    const result = await TscData.deleteMany(query);
    res.json({ message: `${result.deletedCount} records purged successfully.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge data' });
  }
};

exports.deleteTscImport = async (req, res) => {
  try {
    const { id } = req.params;
    await TscData.deleteMany({ importId: id });
    await CRMImport.findByIdAndDelete(id);
    res.json({ message: 'Import deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete import' });
  }
};
