const Lead = require('../models/Lead');
const EMI = require('../models/EMI');
const CRMAudit = require('../models/CRMAudit');
const User = require('../models/User');
const CRMImport = require('../models/CRMImport');

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
    if (req.user.role === 'sales') {
      query.assignedRepId = req.user._id;
    }
    const leads = await Lead.find(query).populate('assignedRepId', 'name email').sort('-createdAt');
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    const leadData = { ...req.body, createdBy: req.user._id };
    
    // Auto-assignment if not specified
    if (!leadData.assignedRepId) {
      leadData.assignedRepId = await assignLeadToRep();
    }

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ error: error.message });
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

    // Capture changes for audit
    const updates = req.body;
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
    res.status(400).json({ error: error.message });
  }
};

exports.getEmis = async (req, res) => {
  try {
    const emis = await EMI.find({ leadId: req.params.leadId }).sort('installmentNo');
    res.json(emis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createEmi = async (req, res) => {
  try {
    const emi = await EMI.create({ ...req.body, leadId: req.params.leadId });
    res.status(201).json(emi);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateEmi = async (req, res) => {
  try {
    const emi = await EMI.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(emi);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await CRMAudit.find({ leadId: req.params.leadId })
      .populate('userId', 'name')
      .sort('-createdAt');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
          // Robust header matching
          const repName = (row.assigned_rep_id || row.Assigned_Rep_Id || row['assigned_rep_id '] || '').toLowerCase().trim();
          let assignedRepId = null;
          
          if (repName && repMap[repName]) {
            assignedRepId = repMap[repName];
          } else if (reps.length > 0) {
            // Round-robin distribution for unassigned
            assignedRepId = reps[repIndex % reps.length]._id;
            repIndex++;
          }

          leadDocs.push({
            name: row.name,
            email: row.email,
            phone: row.phone,
            assignedRepId,
            createdBy: req.user._id,
            leadStatus: 'New',
            callStatus: 'Pending'
          });
        }

        const importSession = await CRMImport.create({
          filename: req.file.originalname,
          leadCount: leadDocs.length,
          createdBy: req.user._id
        });

        const finalDocs = leadDocs.map(d => ({ ...d, importId: importSession._id }));
        await Lead.insertMany(finalDocs);
        
        fs.unlinkSync(req.file.path); // Clean up temp file
        res.status(201).json({ message: `${leadDocs.length} leads uploaded and distributed in batch ${importSession.filename}.` });
      });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
};

exports.getImports = async (req, res) => {
  try {
    const imports = await CRMImport.find()
      .populate('createdBy', 'name')
      .sort('-createdAt');
    res.json(imports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteImport = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await CRMImport.findById(id);
    if (!batch) return res.status(404).json({ error: 'Import batch not found' });

    // Delete all leads associated with this import
    const result = await Lead.deleteMany({ importId: id });
    await CRMImport.findByIdAndDelete(id);

    res.json({ message: `${result.deletedCount} leads successfully purged from system.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
