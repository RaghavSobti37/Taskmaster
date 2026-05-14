const Lead = require('../models/Lead');
const EMI = require('../models/EMI');
const CRMAudit = require('../models/CRMAudit');
const User = require('../models/User');
const CRMImport = require('../models/CRMImport');

// Whitelists for mass-assignment protection
const ALLOWED_LEAD_FIELDS = [
  'name', 'email', 'phone', 'webinarDates', 'attended', 'attendanceDurationMin',
  'meaningfulConnect', 'leadQuality', 'callStatus', 'leadStatus', 'remarks',
  'planOption', 'assignedRepId', 'rowId', 'customerIdExly', 'transactionIdExly',
  'qnaAnswered', 'artistType', 'fullTimeWillingness', 'primaryRole',
  'learningGoal', 'learnedMusic', 'currentJourney', 'nextFollowupDate', 'nextFollowupTime'
];
const ALLOWED_EMI_FIELDS = ['installmentNo','dueDate','amount','status','paidAt'];

const pick = (src, keys) => {
  const r = {};
  for (const k of keys) { if (src[k] !== undefined) r[k] = src[k]; }
  return r;
};

// Helper for auto-assignment (Least-Loaded strategy)
const assignLeadToRep = async () => {
  const reps = await User.find({ role: 'sales' });
  if (reps.length === 0) return null;

  const leadCounts = await Promise.all(reps.map(async (rep) => {
    const count = await Lead.countDocuments({ assignedRepId: rep._id, leadStatus: { $ne: 'Converted' } });
    return { repId: rep._id, count };
  }));

  leadCounts.sort((a, b) => a.count - b.count);
  return leadCounts[0].repId;
};

exports.getLeads = async (req, res) => {
  try {
    let query = {};
    // Security: Non-admins can only see their own assigned leads
    if (req.user.role !== 'admin') {
      query.assignedRepId = req.user._id;
    }

    // Search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Filters
    if (req.query.leadQuality && req.query.leadQuality !== 'all') query.leadQuality = req.query.leadQuality;
    if (req.query.callStatus && req.query.callStatus !== 'all') query.callStatus = req.query.callStatus;
    if (req.query.leadStatus && req.query.leadStatus !== 'all') query.leadStatus = req.query.leadStatus;
    if (req.query.assignedRepId && req.query.assignedRepId !== 'all') query.assignedRepId = req.query.assignedRepId;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .populate('assignedRepId', 'name email avatar')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

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
    if (!leadData.assignedRepId) {
      leadData.assignedRepId = await assignLeadToRep();
    }
    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create lead' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const oldLead = await Lead.findById(id);
    if (!oldLead) return res.status(404).json({ error: 'Lead not found' });

    // Handle locking
    if (oldLead.lockedBy && oldLead.lockedBy.toString() !== req.user._id.toString()) {
      const lockDuration = Date.now() - new Date(oldLead.lockedAt).getTime();
      if (lockDuration < 30 * 60 * 1000) { // 30 min lock
        return res.status(423).json({ error: 'Row is locked by another user' });
      }
    }

    const updates = pick(req.body, ALLOWED_LEAD_FIELDS);
    const auditEntries = [];
    for (const key in updates) {
      if (updates[key] !== oldLead[key] && key !== 'lockedBy' && key !== 'lockedAt') {
        auditEntries.push({
          userId: req.user._id,
          userRole: req.user.role,
          leadId: id,
          fieldChanged: key,
          oldValue: String(oldLead[key] || ''),
          newValue: String(updates[key] || '')
        });
      }
    }

    const lead = await Lead.findByIdAndUpdate(id, { 
      ...updates, 
      lockedBy: req.user._id, 
      lockedAt: new Date() 
    }, { new: true });

    if (auditEntries.length > 0) {
      await CRMAudit.insertMany(auditEntries);
    }

    res.json(lead);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update lead' });
  }
};

exports.getEmis = async (req, res) => {
  try {
    const emis = await EMI.find({ leadId: req.params.leadId }).sort('installmentNo');
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

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await CRMAudit.find({ leadId: req.params.leadId })
      .populate('userId', 'name')
      .sort('-createdAt');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

exports.uploadLeads = async (req, res) => {
  const csv = require('csv-parser');
  const fs = require('fs');
  const results = [];
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file provided' });
  }

  try {
    const reps = await User.find({ role: 'sales' });
    const repMap = {};
    reps.forEach(r => repMap[r.name.toLowerCase().trim()] = r._id);

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const leadDocs = [];
        let repIndex = 0;

        for (const row of results) {
          const repName = (row.assigned_rep_id || row.Assigned_Rep_Id || row['assigned_rep_id '] || row.rep_name || '').toLowerCase().trim();
          let assignedRepId = null;
          
          if (repName && repMap[repName]) {
            assignedRepId = repMap[repName];
          } else if (reps.length > 0) {
            assignedRepId = reps[repIndex % reps.length]._id;
            repIndex++;
          }

          leadDocs.push({
            name: row.name || row.Name || row['Full Name'],
            email: row.email || row.Email,
            phone: row.phone || row.Phone || row['Mobile Number'],
            assignedRepId,
            createdBy: req.user._id,
            leadStatus: row.leadStatus || row.lead_status || 'New',
            callStatus: row.callStatus || row.call_status || 'Pending',
            rowId: row.row_id || row.rowId,
            customerIdExly: row.customer_id_exly || row.customerIdExly,
            transactionIdExly: row.transaction_id_exly || row.transactionIdExly,
            webinarDates: row.webinar_dates || row.webinarDates,
            attended: row.attended || row.Attended,
            attendanceDurationMin: row.attendance_duration_min || row.attendanceDurationMin,
            meaningfulConnect: row.meaningful_connect || row.meaningfulConnect,
            leadQuality: row.lead_quality || row.leadQuality,
            remarks: row.notes || row.remarks || row.Remarks,
            artistType: row.artist_type || row.artistType,
            fullTimeWillingness: row.full_time_willingness || row.fullTimeWillingness,
            primaryRole: row.primary_role || row.primaryRole,
            learningGoal: row.learning_goal || row.learningGoal,
            learnedMusic: row.learned_music || row.learnedMusic,
            currentJourney: row.current_journey || row.currentJourney,
            nextFollowupDate: row.next_followup_date || row.nextFollowupDate,
            nextFollowupTime: row.next_followup_time || row.nextFollowupTime
          });
        }

        const importSession = await CRMImport.create({
          filename: req.file.originalname,
          leadCount: leadDocs.length,
          createdBy: req.user._id
        });

        const finalDocs = leadDocs.map(d => ({ ...d, importId: importSession._id }));
        await Lead.insertMany(finalDocs);
        
        fs.unlinkSync(req.file.path);
        res.status(201).json({ message: `${leadDocs.length} leads uploaded and distributed.` });
      });
  } catch (error) {
    const fs = require('fs');
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.status(500).json({ error: 'Failed to upload leads' });
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
  const results = [];
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file provided' });
  }

  try {
    const reps = await User.find({ role: 'sales' });
    const repMap = {};
    reps.forEach(r => repMap[r.name.toLowerCase().trim()] = r._id);

    const mapping = global.crmMapping || {};

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const leadDocs = [];
        let repIndex = 0;

        for (const row of results) {
          const repName = (row.assigned_rep_id || row.Assigned_Rep_Id || '').toLowerCase().trim();
          let assignedRepId = null;
          
          if (repName && repMap[repName]) {
            assignedRepId = repMap[repName];
          } else if (reps.length > 0) {
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

          // Apply mapping
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

          // Fallback for basic fields if not mapped
          if (!leadDoc.name) leadDoc.name = row.name || row.Name || row['Full Name'] || 'Unknown';
          if (!leadDoc.phone) leadDoc.phone = row.phone || row.Phone || row['Mobile Number'] || '0000000000';
          if (!leadDoc.email) leadDoc.email = row.email || row.Email || '';

          leadDocs.push(leadDoc);
        }

        const importSession = await CRMImport.create({
          filename: req.file.originalname,
          leadCount: leadDocs.length,
          createdBy: req.user._id
        });

        const finalDocs = leadDocs.map(d => ({ ...d, importId: importSession._id }));
        await Lead.insertMany(finalDocs);
        
        fs.unlinkSync(req.file.path);
        res.status(201).json({ message: `${leadDocs.length} leads synchronized via matrix.` });
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

