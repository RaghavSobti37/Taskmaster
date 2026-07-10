const mongoose = require('mongoose');
const OrgAccount = require('../models/OrgAccount');

const populateFields = (query) =>
  query
    .populate('projectIds', 'name workspace')
    .populate('managedBy', 'name email avatar')
    .populate('updatedBy', 'name email avatar')
    .populate('createdBy', 'name email avatar');

const normalizeObjectIds = (value) => {
  if (value == null || value === '') return [];
  const ids = Array.isArray(value) ? value : [value];
  return ids.filter((id) => id && mongoose.Types.ObjectId.isValid(id));
};

const prepareBody = (body, { includeSecret = true } = {}) => {
  const next = { ...body };
  if (Object.prototype.hasOwnProperty.call(body, 'projectIds')) {
    next.projectIds = normalizeObjectIds(body.projectIds);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'managedBy')) {
    next.managedBy = normalizeObjectIds(body.managedBy);
  }
  if (!includeSecret) {
    delete next.secret;
  }
  return next;
};

const toPublicDoc = (doc, { includeSecret = false } = {}) => {
  if (!doc) return doc;
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  const hasSecret = Boolean(plain.secret);
  if (!includeSecret) {
    delete plain.secret;
    plain.hasSecret = hasSecret;
  }
  return plain;
};

const buildListFilter = (query) => {
  const filter = {};
  if (query.projectId && mongoose.Types.ObjectId.isValid(query.projectId)) {
    filter.projectIds = query.projectId;
  }
  if (query.category && ['email', 'social', 'platform', 'other'].includes(query.category)) {
    filter.category = query.category;
  }
  if (query.status && ['active', 'inactive'].includes(query.status)) {
    filter.status = query.status;
  }
  if (query.platform) {
    filter.platform = new RegExp(query.platform.trim(), 'i');
  }
  if (query.search) {
    const term = query.search.trim();
    if (term) {
      filter.$or = [
        { label: new RegExp(term, 'i') },
        { platform: new RegExp(term, 'i') },
        { identifier: new RegExp(term, 'i') },
        { loginEmail: new RegExp(term, 'i') },
        { url: new RegExp(term, 'i') },
      ];
    }
  }
  return filter;
};

exports.listOrgAccounts = async (req, res) => {
  try {
    const filter = buildListFilter(req.query);
    const accounts = await populateFields(
      OrgAccount.find(filter).select('+secret').sort({ updatedAt: -1 })
    );
    res.json(accounts.map((doc) => toPublicDoc(doc)));
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching org accounts' });
  }
};

exports.getOrgAccount = async (req, res) => {
  try {
    const account = await populateFields(
      OrgAccount.findById(req.params.id).select('+secret')
    );
    if (!account) return res.status(404).json({ error: 'Org account not found' });
    res.json(toPublicDoc(account, { includeSecret: true }));
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching org account' });
  }
};

exports.createOrgAccount = async (req, res) => {
  try {
    const account = new OrgAccount({
      ...prepareBody(req.body),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const saved = await account.save();
    const populated = await populateFields(OrgAccount.findById(saved._id));
    res.status(201).json(toPublicDoc(populated));
  } catch (error) {
    res.status(400).json({ error: 'Failed to create org account' });
  }
};

exports.updateOrgAccount = async (req, res) => {
  try {
    const existing = await OrgAccount.findById(req.params.id).select('+secret');
    if (!existing) return res.status(404).json({ error: 'Org account not found' });

    const updates = prepareBody(req.body);
    if (!req.body.secret) {
      delete updates.secret;
    }
    updates.updatedBy = req.user._id;

    await OrgAccount.findByIdAndUpdate(req.params.id, { $set: updates });
    const updated = await populateFields(
      OrgAccount.findById(req.params.id).select('+secret')
    );
    res.json(toPublicDoc(updated, { includeSecret: true }));
  } catch (error) {
    res.status(400).json({ error: 'Failed to update org account' });
  }
};

exports.deleteOrgAccount = async (req, res) => {
  try {
    const deleted = await OrgAccount.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Org account not found' });
    res.json({ message: 'Org account removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete org account' });
  }
};

exports.importOrgAccountsFromSheet = async (req, res) => {
  try {
    const { importOrgAccountsFromSheet: runImport } = require('../services/orgAccountImportService');
    const dryRun = String(req.query.dryRun || req.body?.dryRun || '').toLowerCase() === 'true';
    const result = await runImport({ user: req.user, dryRun });
    res.json({
      message: dryRun ? 'Dry run complete' : 'Import complete',
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to import from Google Sheet' });
  }
};
