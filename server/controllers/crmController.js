const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const EMI = require('../models/EMI');
const CRMAudit = require('../models/CRMAudit');
const User = require('../models/User');
const CRMImport = require('../models/CRMImport');
const CRMConfig = require('../models/CRMConfig');
const {
  sanitizeName,
  sanitizeEmail,
  normalizePhone,
  sanitizeLocation,
  escapeRegExp,
  MAX_NAME_LENGTH,
  isValidEmail,
  isValidPhone,
} = require('../utils/sanitizer');
const followupCache = require('../services/followupCache');
const logger = require('../utils/logger');
const { dispatchEmailPayload } = require('../services/mailDriver');
const { broadcastRealtimeEvent } = require('../config/realtime');
const { queueGamificationEvent } = require('../services/backgroundQueue');
const Department = require('../models/Department');
const { isAdminUser, getDepartmentSlug, SALES_SLUG } = require('../utils/departmentPermissions');
const {
  FOLLOWUP_DATE_FIELD,
  followupDateExistsStage,
  buildFollowupTabMatch,
  buildFollowupStatsGroupStage,
} = require('../utils/followupDateQuery');

const getSalesRepUsers = async (session = null) => {
  const salesDept = await Department.findOne({ slug: SALES_SLUG }).session(session);
  if (!salesDept) return [];
  return User.find({ departmentId: salesDept._id }).session(session);
};

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
const ALLOWED_EMI_FIELDS = ['installmentNo', 'dueDate', 'amount', 'status', 'paidAt'];

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
  const reps = await getSalesRepUsers(session);
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
    if (!isAdminUser(req.user)) {
      query.assignedRepId = new mongoose.Types.ObjectId(req.user._id);
    }

    if (req.query.search) {
      const escaped = escapeRegExp(req.query.search);
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

    const hasFollowupQuery = req.query.hasFollowup === 'true';
    const followupTab = ['today', 'overdue', 'upcoming'].includes(req.query.followupTab)
      ? req.query.followupTab
      : null;
    const followupStages = hasFollowupQuery
      ? [{ $addFields: FOLLOWUP_DATE_FIELD }, followupDateExistsStage]
      : [];
    const tabMatchStage = hasFollowupQuery && followupTab ? buildFollowupTabMatch(followupTab) : null;

    let total;
    let tabStats = null;

    if (hasFollowupQuery) {
      const [statsResult, countResult] = await Promise.all([
        Lead.aggregate([
          { $match: query },
          ...followupStages,
          buildFollowupStatsGroupStage(),
        ]),
        Lead.aggregate([
          { $match: query },
          ...followupStages,
          ...(tabMatchStage ? [tabMatchStage] : []),
          { $count: 'total' },
        ]),
      ]);
      tabStats = statsResult[0] || { today: 0, overdue: 0, upcoming: 0 };
      total = countResult[0]?.total || 0;
    } else {
      total = await Lead.countDocuments(query);
    }

    const pipeline = [
      { $match: query },
      ...followupStages,
      ...(tabMatchStage ? [tabMatchStage] : []),
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
      pages: Math.max(1, Math.ceil(total / limit)),
      ...(tabStats ? { tabStats } : {}),
    });
  } catch (error) {
    logger.error('crmController', 'in getLeads:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

const normalizeLeadInput = (leadData, res) => {
  if (leadData.name != null) {
    leadData.name = sanitizeName(leadData.name);
    if (!leadData.name) {
      res.status(400).json({ error: 'Invalid name' });
      return false;
    }
    if (leadData.name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Name must be at most ${MAX_NAME_LENGTH} characters` });
      return false;
    }
  }
  if (leadData.email != null && leadData.email !== '') {
    leadData.email = sanitizeEmail(leadData.email);
    if (!isValidEmail(leadData.email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return false;
    }
  }
  if (leadData.phone != null && leadData.phone !== '') {
    leadData.phone = normalizePhone(leadData.phone);
    if (!isValidPhone(leadData.phone)) {
      res.status(400).json({ error: 'Invalid phone number' });
      return false;
    }
  }
  if (leadData.city && typeof leadData.city === 'string') leadData.city = sanitizeLocation(leadData.city);
  return true;
};

exports.createLead = async (req, res) => {
  try {
    const leadData = { ...pick(req.body, ALLOWED_LEAD_FIELDS), createdBy: req.user._id };
    if (!normalizeLeadInput(leadData, res)) return;

    // Duplicate check
    const filter = { $or: [] };
    if (leadData.rowId) filter.$or.push({ rowId: leadData.rowId });
    if (leadData.phone) filter.$or.push({ phone: leadData.phone });
    if (leadData.email) filter.$or.push({ email: leadData.email.toLowerCase() });

    if (filter.$or.length > 0) {
      const existing = await Lead.findOne(filter);
      if (existing) {
        return res.status(409).json({
          error: 'A lead with this phone or email already exists',
          duplicateOf: existing._id,
        });
      }
    }

    if (!leadData.assignedRepId) {
      leadData.assignedRepId = await assignLeadToRep();
    }
    const lead = await Lead.create(leadData);
    broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'create' });
    const xpJob = queueGamificationEvent('LEAD_CAPTURED', {
      userId: req.user._id,
      lead: { _id: lead._id },
    });
    if (process.env.QA_SYNC_GAMIFICATION === 'true') await xpJob;
    res.status(201).json(lead);
  } catch (error) {
    logger.error('crmController', 'Create lead ', { error: error.message || error });
    res.status(400).json({ error: 'Failed to create lead' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = pick(req.body, ALLOWED_LEAD_FIELDS);
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid tracking/audit properties provided for mutation' });
    }

    if (!normalizeLeadInput(updates, res)) return;

    // Fetch the current lead to check if this is a first call
    const currentLead = await Lead.findById(id);
    const wasFirstCall = !currentLead?.callStatus && updates.callStatus && updates.callStatus !== 'Pending';

    const followupPatch = {};
    if (currentLead && (updates.nextFollowupDate !== undefined || updates.nextFollowupTime !== undefined)) {
      const dateChanged = updates.nextFollowupDate !== undefined
        && updates.nextFollowupDate !== currentLead.nextFollowupDate;
      const timeChanged = updates.nextFollowupTime !== undefined
        && updates.nextFollowupTime !== currentLead.nextFollowupTime;
      if (dateChanged || timeChanged) {
        followupPatch.reminderSent = false;
        followupPatch.notifiedOverdue = false;
      }
    }

    // The audit plugin handles the delta calculation and logging automatically
    const lead = await Lead.findByIdAndUpdate(id, {
      ...updates,
      ...followupPatch,
      lockedBy: req.user._id,
      lockedAt: new Date()
    }, {
      new: true,
      userId: req.user._id, // Pass to audit plugin
      userRole: getDepartmentSlug(req.user)
    });

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Trigger WhatsApp & Email for first call
    if (wasFirstCall && lead.phone && lead.email) {
      try {
        const leadName = lead.name || 'Prospect';
        const courseTitle = lead.exlyOfferingTitle || 'Our Program';
        const paymentLink = process.env.PAYMENT_LINK || 'https://payment.coreknot.io';

        // Send WhatsApp via AiSensy
        if (lead.phone) {
          const cleanPhone = lead.phone.replace(/\D/g, '');
          await sendAiSensyMessage(
            cleanPhone,
            'call_completed', // Campaign name
            [leadName, courseTitle, paymentLink], // Template params
            null,
            lead.name
          );
          console.log(`✅ WhatsApp sent to ${lead.phone}`);
        }

        // Send Email
        if (lead.email) {
          await dispatchEmailPayload({
            to: lead.email,
            subject: `Great! We connected - Next steps for ${courseTitle}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hi ${leadName},</h2>
                <p>Thank you for connecting with us! We're excited to help you with <strong>${courseTitle}</strong>.</p>
                <p><strong>Next Steps:</strong></p>
                <ol>
                  <li>Review the course details and curriculum</li>
                  <li>Proceed with payment using the link below</li>
                  <li>Complete the enrollment process</li>
                </ol>
                <p>
                  <a href="${paymentLink}" 
                     style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Complete Payment
                  </a>
                </p>
                <p>If you have any questions, feel free to reach out!</p>
                <p>Best regards,<br/>The Team</p>
              </div>
            `,
            from: 'support@coreknot.io'
          });
          console.log(`✅ Email sent to ${lead.email}`);
        }
      } catch (notificationErr) {
        console.error('Error sending first call notifications:', notificationErr);
        // Don't fail the lead update if notifications fail
      }
    }

    broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'update' });
    res.json(lead);
  } catch (error) {
    logger.error('crmController', 'Update lead ', { error: error.message || error });
    res.status(400).json({ error: 'Failed to update lead' });
  }
};

// AiSensy WhatsApp helper
async function sendAiSensyMessage(destination, campaign, params, attributes, userName) {
  const cleanDestination = destination.replace(/\D/g, '');
  const body = {
    apiKey: process.env.AISENSY_API_KEY,
    campaignName: campaign,
    destination: cleanDestination,
    templateParams: params,
    userName: userName || 'User'
  };
  if (attributes) {
    body.attributes = attributes;
  }
  
  if (!process.env.AISENSY_API_KEY) {
      console.warn('[Warning] AISENSY_API_KEY not found in environment, skipping fetch');
      return;
  }

  try {
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    console.log(`[AiSensy Response for ${campaign}]:`, json);
  } catch (e) {
      console.error('[AiSensy] Fetch Error:', e);
  }
}

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
    logger.error('crmController', 'Failed to fetch lead audit logs:', { error: error.message || error });
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
    logger.error('crmController', 'Failed to fetch all audit logs:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};


exports.getImports = async (req, res) => {
  try {
    const imports = await CRMImport.find()
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .lean();
    res.json(imports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch imports' });
  }
};

exports.deleteImport = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
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
      userRole: getDepartmentSlug(req.user),
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
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file provided' });
  }

  try {
    const { importQueue } = require('../workers/importWorker');
    
    // Add job to the queue
    const job = await importQueue.add('csv-import', {
      filePath: req.file.path,
      originalname: req.file.originalname,
      userId: req.user._id,
      mapping: global.crmMapping || {}
    });

    res.status(202).json({ 
      message: 'File uploaded successfully and queued for processing.', 
      jobId: job.id 
    });
  } catch (error) {
    const fs = require('fs');
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) { }
    res.status(500).json({ error: 'Failed to queue import' });
  }
};

exports.getImportJobStatus = async (req, res) => {
  try {
    const { importQueue } = require('../workers/importWorker');
    const job = await importQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const state = await job.getState();
    const progress = job.progress;
    
    res.json({ id: job.id, state, progress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job status' });
  }
};

exports.resetCRM = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    await Lead.deleteMany({});
    await EMI.deleteMany({});
    await CRMImport.deleteMany({});
    await CRMAudit.create({
      userId: req.user._id,
      userRole: getDepartmentSlug(req.user),
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

    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=leads_export.json');
      res.write('[');
      let isFirst = true;
      const cursor = Lead.find({}).populate('assignedRepId', 'name').lean().cursor();
      
      cursor.on('data', doc => {
        if (!isFirst) res.write(',');
        res.write(JSON.stringify(doc));
        isFirst = false;
      });
      cursor.on('end', () => { res.write(']'); res.end(); });
      cursor.on('error', err => {
        logger.error('crmController', 'Export JSON stream error', { error: err.message });
        if (!res.headersSent) res.status(500).end();
      });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
    
    const fields = ['name', 'email', 'phone', 'city', 'leadStatus', 'callStatus', 'leadQuality', 'remarks', 'assignedRep', 'createdAt'];
    res.write(fields.join(',') + '\n');

    const cursor = Lead.find({}).populate('assignedRepId', 'name').lean().cursor();
    
    cursor.on('data', l => {
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
      res.write(row.join(',') + '\n');
    });

    cursor.on('end', () => res.end());
    cursor.on('error', err => {
      logger.error('crmController', 'Export CSV stream error', { error: err.message });
      if (!res.headersSent) res.status(500).end();
    });

  } catch (error) {
    logger.error('crmController', 'Export Init ', { error: error.message || error });
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export leads' });
  }
};

exports.getCRMStats = async (req, res) => {
  try {
    const CRMStatSnapshot = require('../models/CRMStatSnapshot');
    const { calculateStats } = require('../workers/statsWorker');
    const isRep = !isAdminUser(req.user);
    const query = isRep
      ? { repId: new mongoose.Types.ObjectId(req.user._id) }
      : { repId: null };

    let stats = await CRMStatSnapshot.findOne(query).lean();

    const hasFreshMetrics = !!stats?.metrics && (
      stats.metrics.warmLeads !== undefined ||
      stats.metrics.convertedLeads !== undefined ||
      stats.metrics.converted !== undefined
    );

    if (!hasFreshMetrics) {
      const matchStage = isRep
        ? { assignedRepId: new mongoose.Types.ObjectId(req.user._id) }
        : {};
      return res.json(await calculateStats(matchStage));
    }

    const m = stats.metrics;
    res.json({
      totalLeads: m.totalLeads || 0,
      activeReach: m.activeReach ?? m.meaningful ?? 0,
      convertedLeads: m.convertedLeads ?? m.converted ?? 0,
      warmLeads: m.warmLeads || 0,
      conversionRate: m.conversionRate || 0,
      connected: m.connected || 0,
      totalReps: m.totalReps || 0
    });
  } catch (error) {
    logger.error('crmController', 'CRM Stats ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch CRM stats' });
  }
};

exports.getFollowups = async (req, res) => {
  try {
    const FollowupService = require('../services/FollowupService');
    const result = await FollowupService.getPaginatedFollowups(req.user, req.query);

    // Provide headers so old frontend expecting flat array doesn't break entirely,
    // although if it's purely a flat array it may need UI updates eventually.
    // We maintain contract by returning the array itself.
    res.set('X-Total-Count', result.pagination.total);
    res.set('X-Total-Pages', result.pagination.pages);
    res.set('X-Current-Page', result.pagination.page);
    res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Total-Pages, X-Current-Page');

    res.json(result.data);
  } catch (error) {
    logger.error('crmController', 'Failed to fetch followups:', { error: error.message || error });
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
      userRole: getDepartmentSlug(req.user),
      fieldChanged: 'notes',
      oldValue: '',
      newValue: `Note added: "${text.trim()}"`,
      timestamp: new Date()
    });

    broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'update' });
    res.json(lead);
  } catch (error) {
    logger.error('crmController', 'Add note audit ', { error: error.message || error });
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
    logger.error('crmController', 'Rep summary ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch rep summary' });
  }
};

exports.cleanupTestData = async (req, res) => {
  try {
    const { purgeQaTestData } = require('../services/qa/qaTestData');
    const swept = await purgeQaTestData();
    res.json({
      message: `Purged ${swept.deleted.contacts} contacts, ${swept.deleted.leads} leads, and related QA records.`,
      deleted: swept.deleted,
    });
  } catch (error) {
    logger.error('crmController', 'Cleanup test data ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to cleanup test data' });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id }, null, { bypassTenant: true }).lean();
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

    await Lead.findOneAndDelete({ _id: req.params.id }, { bypassTenant: true });
    res.json({ message: `Lead "${lead.name}" permanently deleted.` });
  } catch (error) {
    logger.error('crmController', 'Delete lead ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

exports.purgeAuditLogs = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    await CRMAudit.deleteMany({});
    res.json({ message: 'All lead change audit logs have been purged.' });
  } catch (error) {
    logger.error('crmController', 'Failed to purge lead audits:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to purge audit logs' });
  }
};

