const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const EMI = require('../models/EMI');
const CRMAudit = require('../models/CRMAudit');
const User = require('../models/User');
const CRMImport = require('../models/CRMImport');
const CRMConfig = require('../models/CRMConfig');
const { sanitizeName, sanitizeEmail, normalizePhone, sanitizeLocation } = require('../utils/sanitizer');
const followupCache = require('../services/followupCache');

// Whitelists for mass-assignment protection
const ALLOWED_LEAD_FIELDS = [
  'name', 'email', 'phone', 'city', 'webinarDates', 'attended', 'attendanceDurationMin',
  'meaningfulConnect', 'leadQuality', 'callStatus', 'leadStatus', 'remarks',
  'planOption', 'assignedRepId', 'rowId', 'customerIdExly', 'transactionIdExly',
  'exlyOfferingId', 'exlyOfferingTitle',
  'qnaAnswered', 'artistType', 'fullTimeWillingness', 'primaryRole',
  'learningGoal', 'learnedMusic', 'currentJourney', 'nextFollowupDate', 'nextFollowupTime',
  'emailStatus', 'tags', 'source', 'notes', 'setReminder'
];
const ALLOWED_EMI_FIELDS = ['installmentNo','dueDate','amount','status','paidAt'];

/**
 * Helper utility to pick specific keys from an object.
 * @param {Object} src - Source object
 * @param {Array<String>} keys - Whitelisted keys to extract
 * @returns {Object} Filtered object containing only whitelisted keys
 */
const pick = (src, keys) => {
  const r = {};
  for (const k of keys) { if (src[k] !== undefined) r[k] = src[k]; }
  return r;
};

/**
 * Least-Loaded strategy for automatic lead assignment.
 * Finds the sales rep with the fewest active (non-converted) leads.
 * @returns {Promise<mongoose.Types.ObjectId|null>} ObjectId of the assigned sales rep
 */
const assignLeadToRep = async (session = null) => {
  const reps = await User.find({ role: 'sales' }).session(session);
  if (reps.length === 0) return null;

  const leadCounts = await Promise.all(reps.map(async (rep) => {
    const count = await Lead.countDocuments({ assignedRepId: rep._id, leadStatus: { $ne: 'Converted' } }).session(session);
    return { repId: rep._id, count };
  }));

  leadCounts.sort((a, b) => a.count - b.count);
  return leadCounts[0].repId;
};
exports.assignLeadToRep = assignLeadToRep;

/**
 * Retrieves leads with advanced filtering, searching, and pagination.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getLeads = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.assignedRepId = new mongoose.Types.ObjectId(req.user._id);
    }

    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { city: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (req.query.leadQuality && req.query.leadQuality !== 'all') query.leadQuality = req.query.leadQuality;
    if (req.query.callStatus && req.query.callStatus !== 'all') query.callStatus = req.query.callStatus;
    if (req.query.source && req.query.source !== 'all') query.source = req.query.source;
    
    if (req.query.leadStatus && req.query.leadStatus !== 'all') {
      if (req.query.leadStatus === 'Fresh') {
        query.$or = [
          { leadStatus: null }, 
          { leadStatus: '' }, 
          { leadStatus: 'New' }, 
          { leadStatus: 'Fresh' }, 
          { leadStatus: 'DNP' },
          { leadStatus: { $exists: false } }
        ];
      } else if (req.query.leadStatus === 'Contacted' || req.query.leadStatus === 'In Progress') {
        query.leadStatus = { $in: ['Connected', 'Warm', 'Cold', 'Converted', 'Contacted', 'In Progress', 'Busy', 'Already Purchased'] };
      } else {
        query.leadStatus = req.query.leadStatus;
      }
    }

    if (req.query.assignedRepId && req.query.assignedRepId !== 'all') {
      if (req.query.assignedRepId === 'unassigned' || req.query.assignedRepId === 'null') {
        query.assignedRepId = null;
      } else if (mongoose.Types.ObjectId.isValid(req.query.assignedRepId)) {
        query.assignedRepId = new mongoose.Types.ObjectId(req.query.assignedRepId);
      } else {
        query.assignedRepId = req.query.assignedRepId;
      }
    }
    if (req.query.webinarDates && req.query.webinarDates !== 'all') query.webinarDates = req.query.webinarDates;
    if (req.query.meaningfulConnect && req.query.meaningfulConnect !== 'all') query.meaningfulConnect = req.query.meaningfulConnect;
    if (req.query.artistType && req.query.artistType !== 'all') query.artistType = req.query.artistType;
    if (req.query.primaryRole && req.query.primaryRole !== 'all') query.primaryRole = req.query.primaryRole;
    if (req.query.emailStatus && req.query.emailStatus !== 'all') query.emailStatus = req.query.emailStatus;
    if (req.query.tag && req.query.tag !== 'all') query.tags = req.query.tag;
    if (req.query.hasFollowup === 'true') query.nextFollowupDate = { $exists: true, $ne: '' };
    if (req.query.hasEmail === 'true') query.email = { $type: 'string', $ne: '' };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const total = await Lead.countDocuments(query);
    
    const pipeline = [
      { $match: query },
      { $sort: { [sortField]: sortOrder, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedRepId',
          foreignField: '_id',
          as: 'assignedRep'
        }
      },
      {
        $unwind: {
          path: '$assignedRep',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          assignedRepId: 1,
          name: 1, email: 1, phone: 1, city: 1, source: 1,
          webinarDates: 1, attended: 1, attendanceDurationMin: 1, qnaAnswered: 1,
          artistType: 1, primaryRole: 1, metadata: 1, tags: 1, emailStatus: 1,
          meaningfulConnect: 1, leadQuality: 1, callStatus: 1, leadStatus: 1,
          remarks: 1, notes: 1, setReminder: 1, planOption: 1, nextFollowupDate: 1, nextFollowupTime: 1,
          createdAt: 1, updatedAt: 1,
          exlyOfferings: 1, exlyOfferingTitle: 1, exlyOfferingId: 1,
          'assignedRep.name': 1, 'assignedRep.email': 1, 'assignedRep.avatar': 1
        }
      }
    ];

    const leads = await Lead.aggregate(pipeline);

    res.json({
      leads,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error in getLeads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

exports.createLead = async (req, res) => {
  try {
    const leadData = { ...pick(req.body, ALLOWED_LEAD_FIELDS), createdBy: req.user._id };
    if (leadData.city && typeof leadData.city === 'string') leadData.city = sanitizeLocation(leadData.city);
    
    // Duplicate check
    const filter = { $or: [] };
    if (leadData.rowId) filter.$or.push({ rowId: leadData.rowId });
    if (leadData.phone) filter.$or.push({ phone: leadData.phone });
    if (leadData.email) filter.$or.push({ email: leadData.email.toLowerCase() });

    if (filter.$or.length > 0) {
      const existing = await Lead.findOne(filter);
      if (existing) {
        Object.assign(existing, leadData);
        await existing.save();
        return res.json(existing);
      }
    }

    if (!leadData.assignedRepId) {
      leadData.assignedRepId = await assignLeadToRep();
    }
    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(400).json({ error: 'Failed to create lead' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = pick(req.body, ALLOWED_LEAD_FIELDS);
    if (updates.city && typeof updates.city === 'string') updates.city = sanitizeLocation(updates.city);
    
    // The audit plugin handles the delta calculation and logging automatically
    const lead = await Lead.findByIdAndUpdate(id, { 
      ...updates, 
      lockedBy: req.user._id, 
      lockedAt: new Date() 
    }, { 
      new: true,
      userId: req.user._id, // Pass to audit plugin
      userRole: req.user.role 
    });

    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(400).json({ error: 'Failed to update lead' });
  }
};

exports.getEmis = async (req, res) => {
  try {
    const emis = await EMI.find({ leadId: req.params.leadId }).sort('installmentNo').lean();
    res.json(emis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch EMIs' });
  }
};

exports.createEmi = async (req, res) => {
  try {
    const emiData = { ...pick(req.body, ALLOWED_EMI_FIELDS), leadId: req.params.leadId };
    const emi = await EMI.create(emiData);
    res.status(201).json(emi);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create EMI' });
  }
};

exports.updateEmi = async (req, res) => {
  try {
    const updates = pick(req.body, ALLOWED_EMI_FIELDS);
    const emi = await EMI.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(emi);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update EMI' });
  }
};

const populateAuditUsers = async (logs) => {
  const userIds = [...new Set(logs.map(log => log.userId).filter(id => id && mongoose.isValidObjectId(id)))];
  const users = await User.find({ _id: { $in: userIds } }, 'name email avatar').lean();
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  return logs.map(log => {
    const userIdStr = log.userId ? log.userId.toString() : '';
    if (userMap.has(userIdStr)) {
      log.userId = userMap.get(userIdStr);
    } else {
      log.userId = { name: log.userId || 'System / Batch' };
    }
    return log;
  });
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await CRMAudit.find({ leadId: req.params.leadId })
      .sort('-timestamp')
      .lean();
    const populated = await populateAuditUsers(logs);
    res.json(populated);
  } catch (error) {
    console.error('Failed to fetch lead audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

exports.getAllAuditLogs = async (req, res) => {
  try {
    const query = {};
    if (req.query.userId) {
      query.userId = req.query.userId;
    }
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const logs = await CRMAudit.find(query)
      .populate('leadId', 'name email phone')
      .sort('-timestamp')
      .skip(skip)
      .limit(limit)
      .lean();

    const populated = await populateAuditUsers(logs);
    const total = await CRMAudit.countDocuments(query);

    res.json({
      logs: populated,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Failed to fetch all audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};


exports.getImports = async (req, res) => {
  try {
    const imports = await CRMImport.find()
      .populate('createdBy', 'name')
      .sort('-createdAt');
    res.json(imports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch imports' });
  }
};

exports.deleteImport = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    const { id } = req.params;
    const { reason } = req.body;
    const batch = await CRMImport.findById(id);
    if (!batch) return res.status(404).json({ error: 'Import batch not found' });

    const result = await Lead.deleteMany({ importId: id });
    await CRMImport.findByIdAndDelete(id);

    await CRMAudit.create({
      userId: req.user._id,
      userRole: req.user.role,
      action: 'BATCH_DELETE',
      fieldChanged: 'batch',
      oldValue: batch.filename,
      newValue: 'DELETED',
      notes: reason || 'No reason provided'
    });
    res.json({ message: `${result.deletedCount} leads successfully purged from system.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete import' });
  }
};

exports.getDebugColumns = async (req, res) => {
  const csv = require('csv-parser');
  const fs = require('fs');
  const path = require('path');
  const CSV_PATH = path.join(__dirname, '../../Master Format CRM.csv');
  
  if (!fs.existsSync(CSV_PATH)) {
    return res.status(404).json({ error: 'Master CSV not found' });
  }

  const columns = [];
  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('headers', (headers) => {
      res.json({ 
        columns: headers,
        currentMapping: global.crmMapping || {} 
      });
    })
    .on('error', (err) => res.status(500).json({ error: err.message }));
};

exports.saveMapping = async (req, res) => {
  global.crmMapping = req.body.mapping;
  res.json({ message: 'Mapping synchronized' });
};

exports.uploadLeads = async (req, res) => {
  const csv = require('csv-parser');
  const fs = require('fs');

  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file provided' });
  }

  try {
    const reps = await User.find({ role: 'sales' });
    const repMap = {};
    reps.forEach(r => {
      if (r.name) {
        repMap[r.name.toLowerCase().trim()] = r._id;
      }
    });

    const mapping = global.crmMapping || {};

    const importSession = await CRMImport.create({
      filename: req.file.originalname,
      leadCount: 0,
      createdBy: req.user._id
    });

    let totalProcessed = 0;
    let batch = [];
    const BATCH_SIZE = 500;
    let repIndex = 0;

    const stream = fs.createReadStream(req.file.path).pipe(csv());

    const processBatch = async (rows) => {
      const leadDocs = [];
      for (const row of rows) {
        const rawRepName = (row.assigned_rep_id || row.Assigned_Rep_Id || '').toLowerCase().trim();
        let assignedRepId = null;

        if (rawRepName) {
          const matchedKey = Object.keys(repMap).find(key => rawRepName.includes(key));
          if (matchedKey) {
            assignedRepId = repMap[matchedKey];
          }
        }

        if (!assignedRepId && reps.length > 0) {
          assignedRepId = reps[repIndex % reps.length]._id;
          repIndex++;
        }

        const leadDoc = {
          assignedRepId,
          createdBy: req.user._id,
          leadStatus: 'New',
          callStatus: 'Pending',
          metadata: {}
        };

        for (const [csvCol, dbField] of Object.entries(mapping)) {
          const value = row[csvCol];
          if (!value || dbField === 'IGNORE') continue;

          if (dbField === 'metadata') {
            leadDoc.metadata[csvCol] = value;
          } else if (ALLOWED_LEAD_FIELDS.includes(dbField)) {
            leadDoc[dbField] = value;
          } else {
            leadDoc.metadata[dbField || csvCol] = value;
          }
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
        
        if (filter.$or.length === 0) {
          return { insertOne: { document: { ...doc, importId: importSession._id } } };
        }

        return {
          updateOne: {
            filter,
            update: { $set: { ...doc, importId: importSession._id } },
            upsert: true
          }
        };
      });

      if (bulkOps.length > 0) {
        await Lead.bulkWrite(bulkOps);
      }
      totalProcessed += leadDocs.length;
    };

    stream.on('data', async (data) => {
      batch.push(data);
      if (batch.length >= BATCH_SIZE) {
        stream.pause();
        const rowsToProcess = [...batch];
        batch = [];
        try {
          await processBatch(rowsToProcess);
        } catch (err) {
          console.error('Batch processing error:', err);
        } finally {
          stream.resume();
        }
      }
    });

    stream.on('end', async () => {
      if (batch.length > 0) {
        try {
          await processBatch(batch);
        } catch (err) {
          console.error('Final batch processing error:', err);
        }
      }

      await CRMImport.findByIdAndUpdate(importSession._id, { leadCount: totalProcessed });
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      res.status(201).json({ message: `${totalProcessed} leads successfully processed via memory-efficient stream.` });
    });

    stream.on('error', (error) => {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      res.status(500).json({ error: 'Stream reading error occurred during CSV import' });
    });

  } catch (error) {
    const fs = require('fs');
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.status(500).json({ error: 'Failed to synchronize leads' });
  }
};

exports.resetCRM = async (req, res) => {
  try {
    const { reason } = req.body;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    await Lead.deleteMany({});
    await EMI.deleteMany({});
    await CRMImport.deleteMany({});
    await CRMAudit.create({
      userId: req.user._id,
      userRole: req.user.role,
      action: 'SYSTEM_RESET',
      fieldChanged: 'all',
      oldValue: 'active',
      newValue: 'purged',
      notes: reason || 'System-wide data reset protocol executed.'
    });
    res.json({ message: 'CRM ecosystem successfully purged.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset CRM' });
  }
};

exports.getPurgeLogs = async (req, res) => {
  try {
    const logs = await CRMAudit.find({ action: { $in: ['BATCH_DELETE', 'SYSTEM_RESET'] } })
      .populate('userId', 'name')
      .sort('-createdAt');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purge logs' });
  }
};

exports.exportLeads = async (req, res) => {
  try {
    const { format: exportFormat } = req.query;
    const leads = await Lead.find({}).populate('assignedRepId', 'name');

    if (exportFormat === 'json') {
      return res.json(leads);
    }

    const fields = ['name', 'email', 'phone', 'city', 'leadStatus', 'callStatus', 'leadQuality', 'remarks', 'assignedRep', 'createdAt'];
    
    let csv = fields.join(',') + '\n';
    
    leads.forEach(l => {
      const row = [
        `"${(l.name || '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.city || '').toLowerCase().replace(/"/g, '""')}"`,
        `"${(l.leadStatus || '').replace(/"/g, '""')}"`,
        `"${(l.callStatus || '').replace(/"/g, '""')}"`,
        `"${(l.leadQuality || '').replace(/"/g, '""')}"`,
        `"${(l.remarks || '').replace(/[\r\n]+/g, ' • ').replace(/"/g, '""')}"`,
        `"${(l.assignedRepId?.name || 'Unassigned').replace(/"/g, '""')}"`,
        `"${l.createdAt ? l.createdAt.toISOString() : ''}"`
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export leads' });
  }
};

exports.getCRMStats = async (req, res) => {
  try {
    const matchStage = req.user.role !== 'admin' 
      ? { assignedRepId: new mongoose.Types.ObjectId(req.user._id) } 
      : {};

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
    const activeReach = result.meaningful[0]?.count || 0;
    const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

    res.json({
      totalLeads,
      activeReach,
      convertedLeads,
      conversionRate,
      connected: result.connected[0]?.count || 0,
      totalReps: result.totalReps[0]?.count || 0
    });
  } catch (error) {
    console.error('CRM Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch CRM stats' });
  }
};

exports.getFollowups = async (req, res) => {
  try {
    const isRep = req.user.role !== 'admin';
    const repId = isRep ? req.user._id : null;
    
    // Attempt cache read
    const cachedFollowups = await followupCache.getFollowups(repId);
    if (cachedFollowups !== null) {
      return res.json(cachedFollowups);
    }

    // Fallback to database query if cache fails or is offline
    const query = { nextFollowupDate: { $exists: true, $ne: '' } };
    if (isRep) {
      query.assignedRepId = req.user._id;
    }
    const leads = await Lead.find(query).populate('assignedRepId', 'name avatar').sort({ nextFollowupDate: 1 }).lean();
    const followups = leads.map(l => ({
      ...l,
      date: l.nextFollowupDate,
      time: l.nextFollowupTime,
      status: l.callStatus === 'Connected' || l.leadStatus === 'Converted' ? 'Completed' : 'Pending',
      assignedRep: l.assignedRepId
    }));
    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch followups' });
  }
};

exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

    const lead = await Lead.findByIdAndUpdate(id, {
      $push: {
        notes: {
          text: text.trim(),
          author: req.user.name || req.user.email,
          date: new Date()
        }
      }
    }, { new: true });

    // Explicitly write an audit log entry for note addition
    await CRMAudit.create({
      leadId: id,
      userId: req.user._id,
      userRole: req.user.role,
      fieldChanged: 'notes',
      oldValue: '',
      newValue: `Note added: "${text.trim()}"`,
      timestamp: new Date()
    });

    res.json(lead);
  } catch (error) {
    console.error('Add note audit error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
};

/**
 * Retrieves CRM configurations dynamically from database distinct fields and CRMConfig schema.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCRMConfig = async (req, res) => {
  try {
    const [callStatuses, leadStatuses, artistTypes, webinarDates, meaningfulConnectStatuses, sources, qualities] = await Promise.all([
      Lead.distinct('callStatus'),
      Lead.distinct('leadStatus'),
      Lead.distinct('artistType'),
      Lead.distinct('webinarDates'),
      Lead.distinct('meaningfulConnect'),
      Lead.distinct('source'),
      Lead.distinct('leadQuality')
    ]);

    let configDoc = await CRMConfig.findOne({ configKey: 'default' });
    if (!configDoc) {
      configDoc = await CRMConfig.create({
        configKey: 'default',
        callStatuses: ['Pending', 'Connected', 'Busy', 'DNP', 'Switched Off'],
        leadStatuses: ['New', 'Interested', 'Not Interested', 'Followup', 'Converted'],
        artistTypes: ['Full Time', 'Part Time', 'Hobbyist'],
        meaningfulConnectStatuses: ['YES', 'NO', 'PENDING'],
        qualities: ['1', '2', '3', '4', '5']
      });
    }

    const mergedConfig = {
      callStatuses: Array.from(new Set([...callStatuses.filter(Boolean), ...configDoc.callStatuses])),
      leadStatuses: Array.from(new Set([...leadStatuses.filter(Boolean), ...configDoc.leadStatuses])),
      artistTypes: Array.from(new Set([...artistTypes.filter(Boolean), ...configDoc.artistTypes])),
      webinarDates: webinarDates.filter(Boolean),
      meaningfulConnectStatuses: Array.from(new Set([...meaningfulConnectStatuses.filter(Boolean), ...configDoc.meaningfulConnectStatuses])),
      sources: Array.from(new Set([...sources.filter(Boolean), 'Organic / Direct', 'Webinar', 'Facebook Ads', 'Google Ads', 'Referral'])),
      qualities: Array.from(new Set([...qualities.filter(Boolean), ...configDoc.qualities, '1', '2', '3', '4', '5', 'Future 4']))
    };

    res.json(mergedConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CRM config' });
  }
};

exports.getRepSummary = async (req, res) => {
  try {
    const summary = await Lead.aggregate([
      {
        $group: {
          _id: "$assignedRepId",
          count: { $sum: 1 },
          conv: {
            $sum: {
              $cond: [{ $eq: ["$leadStatus", "Converted"] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "rep"
        }
      },
      {
        $unwind: {
          path: "$rep",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          id: "$_id",
          name: { $ifNull: ["$rep.name", "Unassigned"] },
          count: 1,
          conv: 1,
          rate: {
            $cond: [
              { $gt: ["$count", 0] },
              { $multiply: [{ $divide: ["$conv", "$count"] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);
    res.json(summary);
  } catch (error) {
    console.error('Rep summary error:', error);
    res.status(500).json({ error: 'Failed to fetch rep summary' });
  }
};

exports.cleanupTestData = async (req, res) => {
  try {
    const filter = {
      $or: [
        { name: { $regex: /test|demo|dummy|invalid/i } },
        { email: { $regex: /test|demo|dummy|invalid/i } },
        { emailStatus: { $in: ['Invalid', 'Bounced'] } }
      ]
    };
    const result = await Lead.deleteMany(filter);
    res.json({ message: `Purged ${result.deletedCount} testing/invalid records.` });
  } catch (error) {
    console.error('Cleanup test data error:', error);
    res.status(500).json({ error: 'Failed to cleanup test data' });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).lean();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Log deletion in audit trail before removing
    await CRMAudit.create({
      leadId: lead._id,
      userId: req.user._id,
      fieldChanged: '__deleted__',
      oldValue: lead.name,
      newValue: null,
      timestamp: new Date()
    });

    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: `Lead "${lead.name}" permanently deleted.` });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

exports.purgeAuditLogs = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    await CRMAudit.deleteMany({});
    res.json({ message: 'All lead change audit logs have been purged.' });
  } catch (error) {
    console.error('Failed to purge lead audits:', error);
    res.status(500).json({ error: 'Failed to purge audit logs' });
  }
};

