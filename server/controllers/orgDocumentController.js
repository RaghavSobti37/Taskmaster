const OrgDocument = require('../models/OrgDocument');
const { utapi } = require('../utils/uploadthingServer');
const { ORG_DOCUMENT_CATEGORIES } = require('../../shared/orgDocumentCategories');
const {
  isAllowedFinanceFileUrl,
  downloadFinanceFile,
  sendInlineFile,
} = require('../utils/financeFileProxy');

const MAX_FILE_BYTES = 32 * 1024 * 1024;

function normalizeTags(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))];
}

function normalizeCategory(value) {
  const trimmed = String(value || 'Other').trim();
  return trimmed || 'Other';
}

function buildListFilter(query = {}) {
  const filter = {};
  if (query.category && query.category !== 'all') {
    filter.category = normalizeCategory(query.category);
  }
  if (query.tag) {
    filter.tags = String(query.tag).trim();
  }
  if (query.q) {
    const q = String(query.q).trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
        { fileName: regex },
      ];
    }
  }
  return filter;
}

const listDocuments = async (req, res) => {
  try {
    const docs = await OrgDocument.find(buildListFilter(req.query))
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: docs, categories: ORG_DOCUMENT_CATEGORIES });
  } catch (error) {
    console.error('List org documents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createDocument = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      sourceType,
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      fileType,
      externalUrl,
    } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    if (!['file', 'link'].includes(sourceType)) {
      return res.status(400).json({ success: false, message: 'sourceType must be file or link' });
    }
    if (sourceType === 'file') {
      if (!fileUrl || !isAllowedFinanceFileUrl(fileUrl)) {
        return res.status(400).json({ success: false, message: 'Valid fileUrl is required' });
      }
    } else if (!externalUrl?.trim()) {
      return res.status(400).json({ success: false, message: 'externalUrl is required for links' });
    }

    const doc = await OrgDocument.create({
      title: title.trim(),
      description: description?.trim() || '',
      category: normalizeCategory(category),
      tags: normalizeTags(tags),
      sourceType,
      fileUrl: sourceType === 'file' ? fileUrl : '',
      fileKey: sourceType === 'file' ? fileKey : undefined,
      fileName: sourceType === 'file' ? fileName : undefined,
      fileSize: sourceType === 'file' ? fileSize : undefined,
      fileType: sourceType === 'file' ? fileType : undefined,
      externalUrl: sourceType === 'link' ? externalUrl.trim() : '',
      uploadedBy: req.user._id,
    });

    const populated = await OrgDocument.findById(doc._id)
      .populate('uploadedBy', 'name email')
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create org document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

const updateDocument = async (req, res) => {
  try {
    const doc = await OrgDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const { title, description, category, tags } = req.body || {};
    if (title !== undefined) doc.title = String(title).trim();
    if (description !== undefined) doc.description = String(description).trim();
    if (category !== undefined) doc.category = normalizeCategory(category);
    if (tags !== undefined) doc.tags = normalizeTags(tags);

    await doc.save();

    const populated = await OrgDocument.findById(doc._id)
      .populate('uploadedBy', 'name email')
      .lean();

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Update org document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await OrgDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (doc.sourceType === 'file' && doc.fileKey) {
      try {
        await utapi.deleteFiles(doc.fileKey);
      } catch (err) {
        console.error('UploadThing delete failed:', err.message);
      }
    }

    await doc.deleteOne();
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete org document error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const streamDocumentFile = async (req, res) => {
  try {
    const doc = await OrgDocument.findById(req.params.id).lean();
    if (!doc || doc.sourceType !== 'file') {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    if (!doc.fileUrl) {
      return res.status(404).json({ success: false, message: 'No file attached' });
    }

    const buffer = await downloadFinanceFile(doc.fileUrl, MAX_FILE_BYTES);
    sendInlineFile(res, buffer, {
      contentType: doc.fileType,
      fileName: doc.fileName || doc.title || 'document',
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Stream org document error:', error);
    res.status(status).json({
      success: false,
      message: status === 400 ? error.message : 'Failed to load file',
    });
  }
};

module.exports = {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  streamDocumentFile,
};
