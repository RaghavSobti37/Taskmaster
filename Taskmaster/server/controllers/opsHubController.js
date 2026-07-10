const OpsEntity = require('../models/OpsEntity');
const OpsWeeklyCycle = require('../models/OpsWeeklyCycle');
const { DOMAINS, STATUSES, getWeekKey } = require('../../shared/opsTaxonomy');

function hasOpsReadAccess(user) {
  const perms = user?.pagePermissions || [];
  const keys = [
    'admin_ops_hub',
    'ops_hub_academy',
    'ops_hub_media',
    'ops_hub_show_booking',
    'ops_hub_influencers',
  ];
  if (user?.departmentId?.slug === 'admin') return true;
  return keys.some((k) => perms.includes(k));
}

function canWriteDomain(user, domain) {
  if (!user) return false;
  if (user?.departmentId?.slug === 'admin') return true;
  const perms = user?.pagePermissions || [];
  if (perms.includes('admin_ops_hub')) return true;
  const map = {
    academy: 'ops_hub_academy',
    media: 'ops_hub_media',
    show_booking: 'ops_hub_show_booking',
    influencers: 'ops_hub_influencers',
  };
  const key = map[domain];
  return key ? perms.includes(key) : false;
}

exports.getTaxonomy = (_req, res) => {
  res.json({ domains: DOMAINS, statuses: STATUSES });
};

exports.listEntities = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};
    if (req.query.domain && req.query.domain !== 'all') filter.domain = req.query.domain;
    if (req.query.subtype) filter.subtype = req.query.subtype;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
      filter.$text = { $search: req.query.q };
    }
    const [items, total] = await Promise.all([
      OpsEntity.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assigneeId', 'name email')
        .lean(),
      OpsEntity.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEntity = async (req, res) => {
  try {
    const entity = await OpsEntity.findById(req.params.id).populate('assigneeId', 'name email').lean();
    if (!entity) return res.status(404).json({ error: 'Not found' });
    res.json(entity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createEntity = async (req, res) => {
  try {
    const { domain, subtype, name, status, organization, city, email, phone, notes } = req.body;
    if (!domain || !name) return res.status(400).json({ error: 'domain and name required' });
    if (!canWriteDomain(req.user, domain)) return res.status(403).json({ error: 'Forbidden' });
    const weekKey = getWeekKey();
    const created = await OpsEntity.create({
      domain,
      subtype: subtype || '',
      name,
      status: status || 'new',
      organization,
      city,
      email,
      phone,
      notes,
      createdWeekKey: weekKey,
      lastWeeklyTouchAt: new Date(),
      updatedBy: req.user._id,
      assigneeId: req.user._id,
    });
    const populated = await OpsEntity.findById(created._id).populate('assigneeId', 'name email').lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateEntity = async (req, res) => {
  try {
    const existing = await OpsEntity.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canWriteDomain(req.user, existing.domain)) return res.status(403).json({ error: 'Forbidden' });
    const fields = ['name', 'subtype', 'status', 'organization', 'city', 'email', 'phone', 'notes', 'assigneeId'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) existing[f] = req.body[f];
    });
    existing.lastWeeklyTouchAt = new Date();
    existing.updatedBy = req.user._id;
    await existing.save();
    const populated = await OpsEntity.findById(existing._id).populate('assigneeId', 'name email').lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWeekly = async (req, res) => {
  try {
    const weekKey = req.query.weekKey || getWeekKey();
    const submissions = await OpsWeeklyCycle.find({ weekKey }).lean();
    const sections = DOMAINS.map((d) => {
      const sub = submissions.find((s) => s.domain === d.key);
      return {
        domain: d.key,
        label: d.label,
        color: d.color,
        submitted: !!sub?.submittedAt,
        submittedAt: sub?.submittedAt || null,
      };
    });
    res.json({ weekKey, sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitWeekly = async (req, res) => {
  try {
    const { domain, weekKey: bodyWeekKey, notes } = req.body;
    const weekKey = bodyWeekKey || getWeekKey();
    if (!domain) return res.status(400).json({ error: 'domain required' });
    if (!canWriteDomain(req.user, domain)) return res.status(403).json({ error: 'Forbidden' });
    const doc = await OpsWeeklyCycle.findOneAndUpdate(
      { weekKey, domain },
      { submittedAt: new Date(), submittedBy: req.user._id, notes: notes || '' },
      { upsert: true, returnDocument: 'after' },
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const weekKey = req.query.weekKey || getWeekKey();
    const weekStart = new Date();
    const [totalEntities, byDomain, byStatus, touchedThisWeek, newThisWeek, submissions] = await Promise.all([
      OpsEntity.countDocuments(),
      OpsEntity.aggregate([{ $group: { _id: '$domain', count: { $sum: 1 } } }]),
      OpsEntity.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      OpsEntity.countDocuments({ lastWeeklyTouchAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
      OpsEntity.countDocuments({ createdWeekKey: weekKey }),
      OpsWeeklyCycle.countDocuments({ weekKey, submittedAt: { $ne: null } }),
    ]);
    const domainLabels = Object.fromEntries(DOMAINS.map((d) => [d.key, d.label]));
    res.json({
      weekKey,
      totals: {
        entities: totalEntities,
        touchedThisWeek,
        newThisWeek,
        submittedSections: submissions,
        totalSections: DOMAINS.length,
      },
      byDomain: byDomain.map((row) => ({
        key: row._id,
        label: domainLabels[row._id] || row._id,
        count: row.count,
      })),
      byStatus: byStatus.map((row) => ({ key: row._id, count: row.count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.hasOpsReadAccess = hasOpsReadAccess;
