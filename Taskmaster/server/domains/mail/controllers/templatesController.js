const MailTemplate = require('../models/MailTemplate');
const mailTemplateRepository = require('../repositories/mailTemplateRepository');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { canApproveMailTemplates } = require('../../../utils/mailTemplateApprovers');
const {
  migrateLegacyTemplates,
  mapToObject,
  notifyAdminsTemplateSubmitted,
  assertCanEditTemplate,
} = require('../../../utils/mailTemplateHelpers');
const { parseIndexedVariablesFromHtml } = require('../../../utils/indexedTemplateVariables');
const { normalizeOutboundEmailHtml } = require('../../../utils/normalizeOutboundEmailHtml');

exports.listPending = async (req, res) => {
  try {
    if (!canApproveMailTemplates(req.user)) {
      return res.status(403).json({ error: 'Mail template approval access required' });
    }
    await migrateLegacyTemplates();
    const templates = await mailTemplateRepository.find({ status: 'pending_approval' })
      .sort({ submittedAt: -1 })
      .populate('createdBy', 'name email');
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    await migrateLegacyTemplates();
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const templates = await mailTemplateRepository.find(filter).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const template = await mailTemplateRepository.findById(req.params.id).populate('createdBy', 'name email');
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const mergeTemplateAssets = (existing = [], incoming) => {
  if (!Array.isArray(incoming)) return existing;
  const byUrl = new Map();
  (existing || []).forEach((asset) => {
    if (asset?.url) byUrl.set(asset.url, asset);
  });
  incoming.forEach((asset) => {
    if (asset?.url) byUrl.set(asset.url, asset);
  });
  return [...byUrl.values()];
};

exports.saveDraft = async (req, res) => {
  try {
    const { id, name, content, format, subject, dummyValues, assets } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'name and content are required' });
    }
    const isRawHtml = format === 'rawHtml';
    const normalizedContent = isRawHtml ? content : normalizeOutboundEmailHtml(content);
    const payload = {
      name: String(name).trim(),
      content: normalizedContent,
      format: isRawHtml ? 'rawHtml' : 'visual',
      subject: subject || '',
      status: 'draft',
      dummyValues: dummyValues && typeof dummyValues === 'object' ? dummyValues : {},
      submittedAt: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      rejectionNote: undefined,
      approvedContent: undefined,
    };
    if (Array.isArray(assets)) payload.assets = assets;

    let template;
    if (id) {
      template = await MailTemplate.findById(id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      const editCheck = assertCanEditTemplate(template, req.user);
      if (!editCheck.ok) return res.status(403).json({ error: editCheck.error });

      if (template.status === 'approved') {
        const approvedRaw = (format !== undefined ? format === 'rawHtml' : template.format === 'rawHtml');
        const approvedContent = approvedRaw ? content : normalizeOutboundEmailHtml(content);
        template.content = approvedContent;
        template.approvedContent = approvedContent;
        if (name) template.name = String(name).trim();
        if (subject !== undefined) template.subject = subject;
        if (format !== undefined) template.format = approvedRaw ? 'rawHtml' : 'visual';
        if (dummyValues && typeof dummyValues === 'object') template.dummyValues = dummyValues;
        if (Array.isArray(assets)) template.assets = mergeTemplateAssets(template.assets, assets);
        await template.save();
        return res.json(template);
      }

      if (!['draft', 'rejected'].includes(template.status) && !isAdminUser(req.user)) {
        return res.status(400).json({ error: 'Only draft or rejected templates can be saved as draft' });
      }
      Object.assign(template, payload);
      if (template.status === 'rejected') template.status = 'draft';
      await template.save();
    } else {
      const existing = await MailTemplate.findOne({ name: payload.name });
      if (existing && existing.createdBy?.toString() !== req.user._id.toString() && !isAdminUser(req.user)) {
        return res.status(409).json({ error: 'Template name already in use' });
      }
      if (existing) {
        const editCheck = assertCanEditTemplate(existing, req.user);
        if (!editCheck.ok) return res.status(403).json({ error: editCheck.error });
        Object.assign(existing, payload);
        if (existing.status === 'rejected') existing.status = 'draft';
        template = await existing.save();
      } else {
        template = await MailTemplate.create({ ...payload, createdBy: req.user._id });
      }
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const template = await MailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const editCheck = assertCanEditTemplate(template, req.user);
    if (!editCheck.ok) return res.status(403).json({ error: editCheck.error });

    const { name, content, format, subject, dummyValues, assets } = req.body;
    if (name) template.name = String(name).trim();
    if (format !== undefined) template.format = format === 'rawHtml' ? 'rawHtml' : 'visual';
    if (content !== undefined) {
      const isRawHtml = (format !== undefined ? format === 'rawHtml' : template.format === 'rawHtml');
      const normalizedContent = isRawHtml ? content : normalizeOutboundEmailHtml(content);
      template.content = normalizedContent;
      if (template.status === 'approved') template.approvedContent = normalizedContent;
    }
    if (subject !== undefined) template.subject = subject;
    if (dummyValues && typeof dummyValues === 'object') template.dummyValues = dummyValues;
    if (Array.isArray(assets)) template.assets = mergeTemplateAssets(template.assets, assets);
    await template.save();
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submit = async (req, res) => {
  try {
    const template = await MailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!['draft', 'rejected'].includes(template.status)) {
      return res.status(400).json({ error: 'Only draft or rejected templates can be submitted' });
    }
    if (template.createdBy?.toString() !== req.user._id.toString() && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const dummies = mapToObject(template.dummyValues);
    const indices = parseIndexedVariablesFromHtml(`${template.content || ''}${template.subject || ''}`);
    const missingDummies = indices.filter((i) => !dummies[i] && !dummies[String(i)]);
    if (missingDummies.length) {
      return res.status(400).json({
        error: `Provide dummy values for variables: ${missingDummies.map((i) => `{${i}}`).join(', ')}`,
      });
    }

    template.status = 'pending_approval';
    template.submittedAt = new Date();
    template.rejectionNote = undefined;
    await template.save();
    await notifyAdminsTemplateSubmitted(template, req.user);
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    if (!canApproveMailTemplates(req.user)) {
      return res.status(403).json({ error: 'Mail template approval access required' });
    }
    const template = await MailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Template is not pending approval' });
    }
    const { content, subject } = req.body || {};
    const isRawHtml = template.format === 'rawHtml';
    let approvedBody;
    if (content !== undefined) {
      approvedBody = isRawHtml ? content : normalizeOutboundEmailHtml(content);
    } else {
      approvedBody = isRawHtml ? template.content : normalizeOutboundEmailHtml(template.content);
    }
    template.approvedContent = approvedBody;
    template.content = approvedBody;
    if (subject !== undefined) template.subject = subject;
    template.status = 'approved';
    template.approvedAt = new Date();
    template.approvedBy = req.user._id;
    template.rejectionNote = undefined;
    await template.save();
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reject = async (req, res) => {
  try {
    if (!canApproveMailTemplates(req.user)) {
      return res.status(403).json({ error: 'Mail template approval access required' });
    }
    const template = await MailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Template is not pending approval' });
    }
    template.status = 'rejected';
    template.rejectionNote = req.body.rejectionNote || '';
    await template.save();
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const template = await MailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.createdBy?.toString() !== req.user._id.toString() && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (template.status === 'approved') {
      return res.status(400).json({ error: 'Cannot delete approved templates' });
    }
    await MailTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
