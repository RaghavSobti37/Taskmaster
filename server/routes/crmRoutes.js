const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getLeads, 
  getLeadByRowIndex, 
  updateLead, 
  appendLead, 
  getEmisByLead, 
  appendEmi,
  appendAudit
} = require('../crm/lib/csv-store');
const { LEADS_HEADERS } = require('../crm/lib/schema');

// Middleware to check if user is sales or admin
const salesOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'sales')) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized for CRM' });
  }
};

router.use(protect);
router.use(salesOrAdmin);

// GET /api/crm/leads
router.get('/leads', (req, res) => {
  try {
    const { search, rep } = req.query;
    let leads = getLeads();

    // In a real integration, we'd filter by user role here
    // For now, let's just return all as per admin/sales access
    
    if (search) {
      const s = search.toLowerCase();
      leads = leads.filter(l => 
        (l.name && l.name.toLowerCase().includes(s)) ||
        (l.email && l.email.toLowerCase().includes(s)) ||
        (l.phone && l.phone.includes(s))
      );
    }

    if (rep) {
      leads = leads.filter(l => l.assigned_to === rep);
    }

    res.json({ data: leads, count: leads.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/crm/leads/:rowIndex
router.get('/leads/:rowIndex', (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    const lead = getLeadByRowIndex(rowIndex);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    
    const emis = getEmisByLead(lead.row_id || String(rowIndex));
    res.json({ ...lead, row_index: rowIndex, emis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/crm/leads/:rowIndex
router.patch('/leads/:rowIndex', (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    const existing = getLeadByRowIndex(rowIndex);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    const updates = req.body;
    
    // Audit log
    const auditRow = {
      timestamp: new Date().toISOString(),
      user_id: req.user._id.toString(),
      lead_row_id: existing.row_id || String(rowIndex),
      field: 'updated',
      old_value: '',
      new_value: Object.keys(updates).join(',')
    };
    appendAudit(auditRow);

    updateLead(rowIndex, updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/leads
router.post('/leads', (req, res) => {
  try {
    const lead = req.body;
    lead.created_at = new Date().toISOString();
    lead.row_id = Date.now().toString(); // Simple unique ID
    appendLead(lead);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/emis
router.post('/emis', (req, res) => {
  try {
    const emi = req.body;
    appendEmi(emi);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
