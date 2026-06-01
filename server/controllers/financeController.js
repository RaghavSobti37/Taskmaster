const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const { UTApi, UTFile } = require('uploadthing/server');
const axios = require('axios');
const { parseDocument } = require('../utils/documentParser');
const { isAdminUser, isOpsUser } = require('../utils/departmentPermissions');
const { queueGamificationEvent } = require('../services/backgroundQueue');

// Extract sk_ API key from base64 UPLOADTHING_TOKEN
let utApiKey;
try {
  const tokenData = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN || '', 'base64').toString());
  utApiKey = tokenData.apiKey;
} catch { utApiKey = process.env.UPLOADTHING_SECRET; }

const utapi = new UTApi({ apiKey: utApiKey });

const populateFinanceDoc = (id) =>
  FinanceDocument.findById(id)
    .populate('uploadedBy', 'name email avatar')
    .populate('project', 'name')
    .populate('folderId', 'folderName title isFolder')
    .lean();

// Direct file upload via server-side UTApi (bypasses React client version issues)
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(
        path.join(__dirname, '../../debug-0c5d79.log'),
        `${JSON.stringify({
          sessionId: '0c5d79',
          runId: 'post-fix',
          timestamp: Date.now(),
          location: 'financeController.js:uploadFile',
          message: 'server-side invoice upload started',
          hypothesisId: 'H2',
          data: {
            route: req.originalUrl,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
          },
        })}\n`
      );
    } catch (_) {}
    // #endregion

    const { buffer, originalname, mimetype, size } = req.file;
    const utFile = new UTFile([buffer], originalname, { type: mimetype });
    const uploadResult = await utapi.uploadFiles([utFile]);

    if (!uploadResult[0]?.data) {
      const errObj = uploadResult[0]?.error;
      console.error('[UploadThing API Error Details]:', errObj);
      const errMsg = errObj?.message || 'Upload to storage failed';
      return res.status(500).json({ success: false, message: errMsg });
    }

    const { url, key, name } = uploadResult[0].data;
    res.json({
      success: true,
      data: { url, key, name: name || originalname, size, type: mimetype }
    });
  } catch (error) {
    console.error('File upload error:', error);
    if (error.data || error.cause) {
      console.error('[UploadThing Error Context]:', error.data, error.cause);
    }
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadOneFileToUT = async (file, maxAttempts = 3) => {
  let lastError = 'Upload failed';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const utFile = new UTFile([file.buffer], file.originalname, { type: file.mimetype });
      const uploadResult = await utapi.uploadFiles([utFile]);

      if (uploadResult[0]?.data) {
        const { url, key, name } = uploadResult[0].data;
        return {
          url: url || uploadResult[0].data.ufsUrl,
          key,
          name: name || file.originalname,
          size: file.size,
          type: file.mimetype,
        };
      }
      lastError = uploadResult[0]?.error?.message || lastError;
    } catch (err) {
      lastError = err.message || lastError;
    }
    if (attempt < maxAttempts) await sleep(1500 * attempt);
  }
  throw new Error(lastError);
};

// Multi-file upload via server-side UTApi (batched by client; retries per file)
const uploadFilesMany = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    const data = [];
    const failed = [];

    for (const file of files) {
      try {
        const result = await uploadOneFileToUT(file);
        data.push(result);
      } catch (err) {
        console.error(`Upload failed for ${file.originalname}:`, err.message);
        failed.push({ fileName: file.originalname, error: err.message });
      }
      await sleep(300);
    }

    const message = failed.length
      ? `${data.length} uploaded, ${failed.length} failed`
      : `${data.length} file(s) uploaded`;

    res.status(failed.length && data.length === 0 ? 500 : 200).json({
      success: data.length > 0,
      data,
      failed,
      message,
    });
  } catch (error) {
    console.error('Multi file upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};


const uploadDocument = async (req, res) => {
  try {
    const { title, description, project, category, fileUrl, fileKey, fileName, fileSize, fileType, folderId } = req.body;

    if (!title || !project || !fileUrl) {
      return res.status(400).json({ success: false, message: 'Title, project, and file URL are required' });
    }

    if (folderId) {
      const folder = await FinanceDocument.findOne({ _id: folderId, isFolder: true, project });
      if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found for this project' });
      }
    }

    // Validate project exists
    const projectDoc = await Project.findById(project).lean();
    if (!projectDoc) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Run OCR parsing if URL is provided
    let extractedText = '';
    let docMetadata = {};
    if (fileUrl) {
      try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const mimeType = fileType || fileName?.split('.').pop() || 'application/pdf';
        const parsed = await parseDocument(buffer, mimeType);
        extractedText = parsed.extractedText;
        docMetadata = parsed.metadata;
      } catch (err) {
        console.error('Error parsing document for OCR:', err);
      }
    }

    const doc = new FinanceDocument({
      title,
      description: description || '',
      project,
      folderId: folderId || null,
      category: category || docMetadata.detectedCategory || 'other',
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      fileType,
      uploadedBy: req.user._id,
      extractedText,
      metadata: {
        amount: docMetadata.amount || 0,
        currency: docMetadata.currency || 'INR',
        vendor: docMetadata.vendor || '',
        date: docMetadata.date || null,
        tax: docMetadata.tax || 0,
        detectedCategory: docMetadata.detectedCategory || 'other'
      }
    });

    await doc.save();

    const populated = await populateFinanceDoc(doc._id);

    res.status(201).json({ success: true, data: populated, message: 'Document uploaded' });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const uploadDocumentsBulk = async (req, res) => {
  try {
    const { documents } = req.body;
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, message: 'Documents array is required' });
    }

    const savedDocs = [];
    for (const d of documents) {
      const { title, description, project, category, fileUrl, fileKey, fileName, fileSize, fileType, folderId } = d;
      if (!title || !project || !fileUrl) continue;

      if (folderId) {
        const folder = await FinanceDocument.findOne({ _id: folderId, isFolder: true, project });
        if (!folder) continue;
      }

      let extractedText = '';
      let docMetadata = {};
      try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const mimeType = fileType || fileName?.split('.').pop() || 'application/pdf';
        const parsed = await parseDocument(buffer, mimeType);
        extractedText = parsed.extractedText;
        docMetadata = parsed.metadata;
      } catch (err) {
        console.error('Error parsing document for OCR in bulk:', err);
      }

      const doc = new FinanceDocument({
        title,
        description: description || '',
        project,
        folderId: folderId || null,
        category: category || docMetadata.detectedCategory || 'other',
        fileUrl,
        fileKey,
        fileName,
        fileSize,
        fileType,
        uploadedBy: req.user._id,
        extractedText,
        metadata: {
          amount: docMetadata.amount || 0,
          currency: docMetadata.currency || 'INR',
          vendor: docMetadata.vendor || '',
          date: docMetadata.date || null,
          tax: docMetadata.tax || 0,
          detectedCategory: docMetadata.detectedCategory || 'other'
        }
      });

      await doc.save();
      savedDocs.push(doc._id);
    }

    const populatedDocs = await FinanceDocument.find({ _id: { $in: savedDocs } })
      .populate('uploadedBy', 'name email avatar')
      .populate('project', 'name')
      .populate('folderId', 'folderName title isFolder')
      .sort({ createdAt: -1 })
      .lean();

    res.status(201).json({ success: true, data: populatedDocs, message: `${populatedDocs.length} documents uploaded` });
  } catch (error) {
    console.error('Bulk upload documents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getDocuments = async (req, res) => {
  try {
    const { project, category, page, limit, startDate, endDate, searchQuery, folderId, sortField, sortOrder } = req.query;
    const filter = { approvalStatus: { $ne: 'pending' } };

    if (project) filter.project = project;

    // Folder navigation: root shows folders + root docs; inside folder shows docs only
    if (folderId) {
      filter.isFolder = { $ne: true };
      filter.folderId = folderId;
    } else if (project && !folderId) {
      // Project root: folders first, then root-level documents only
      filter.$or = [
        { isFolder: true, parentFolderId: null },
        { isFolder: { $ne: true }, $or: [{ folderId: null }, { folderId: { $exists: false } }] },
      ];
    } else if (!project) {
      // All projects: folders + documents (navigate into folder via ?folderId=)
      filter.$or = [
        { isFolder: true, parentFolderId: null },
        { isFolder: { $ne: true } },
      ];
    }

    if (category && category !== 'all') filter.category = category;

    if (startDate || endDate) {
      const docDateRange = {};
      if (startDate) docDateRange.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        docDateRange.$lte = end;
      }
      const dateClause = {
        $or: [
          { isFolder: true },
          { 'metadata.date': docDateRange },
        ],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, dateClause];
        delete filter.$or;
      } else {
        filter.$and = [dateClause];
      }
    }

    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'i');
      const searchOr = [
        { title: regex },
        { folderName: regex },
        { fileName: regex },
        { 'metadata.vendor': regex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const pageVal = parseInt(page) || 1;
    const limitVal = parseInt(limit) || 10;
    const skip = (pageVal - 1) * limitVal;

    const SORTABLE = {
      title: 'title',
      category: 'category',
      fileSize: 'fileSize',
      docDate: 'metadata.date',
      folderName: 'folderName',
    };
    const order = sortOrder === 'asc' ? 1 : -1;
    let sort = { isFolder: -1, folderName: 1, 'metadata.date': -1, createdAt: -1 };
    if (sortField && SORTABLE[sortField]) {
      const key = SORTABLE[sortField];
      sort = { isFolder: -1, [key]: order };
      if (sortField === 'docDate') sort.createdAt = order;
      if (sortField === 'title') sort.fileName = order;
    }

    const total = await FinanceDocument.countDocuments(filter);

    let docs = await FinanceDocument.find(filter)
      .populate('uploadedBy', 'name email avatar')
      .populate('project', 'name')
      .populate('folderId', 'folderName title isFolder')
      .sort(sort)
      .skip(skip)
      .limit(limitVal)
      .lean();

    // Attach document counts to folder rows
    const folderIds = docs.filter((d) => d.isFolder).map((d) => d._id);
    if (folderIds.length > 0) {
      const counts = await FinanceDocument.aggregate([
        { $match: { folderId: { $in: folderIds }, isFolder: { $ne: true } } },
        { $group: { _id: '$folderId', count: { $sum: 1 } } },
      ]);
      const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
      docs = docs.map((d) =>
        d.isFolder ? { ...d, documentCount: countMap[d._id.toString()] || 0 } : d
      );
    }

    let currentFolder = null;
    if (folderId) {
      currentFolder = await FinanceDocument.findOne({ _id: folderId, isFolder: true })
        .populate('project', 'name')
        .lean();
    }

    res.json({
      success: true,
      data: docs,
      currentFolder,
      pagination: {
        total,
        page: pageVal,
        limit: limitVal,
        pages: Math.ceil(total / limitVal) || 1,
      },
    });
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createFolder = async (req, res) => {
  try {
    const { folderName, project, parentFolderId } = req.body;
    if (!folderName || !project) {
      return res.status(400).json({ success: false, message: 'folderName and project are required' });
    }

    const projectDoc = await Project.findById(project).lean();
    if (!projectDoc) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (parentFolderId) {
      const parent = await FinanceDocument.findOne({ _id: parentFolderId, isFolder: true, project });
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent folder not found' });
      }
    }

    const existing = await FinanceDocument.findOne({
      isFolder: true,
      project,
      folderName: folderName.trim(),
      parentFolderId: parentFolderId || null,
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Folder already exists' });
    }

    const folder = new FinanceDocument({
      isFolder: true,
      folderName: folderName.trim(),
      title: folderName.trim(),
      project,
      parentFolderId: parentFolderId || null,
      uploadedBy: req.user._id,
      category: 'other',
    });

    await folder.save();
    const populated = await populateFinanceDoc(folder._id);
    res.status(201).json({ success: true, data: populated, message: 'Folder created' });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

const getFolders = async (req, res) => {
  try {
    const { project, parentFolderId } = req.query;
    if (!project) {
      return res.status(400).json({ success: false, message: 'project is required' });
    }

    const filter = {
      isFolder: true,
      project,
      parentFolderId: parentFolderId || null,
    };

    const folders = await FinanceDocument.find(filter)
      .populate('project', 'name')
      .sort({ folderName: 1 })
      .lean();

    const folderIds = folders.map((f) => f._id);
    const counts = await FinanceDocument.aggregate([
      { $match: { folderId: { $in: folderIds }, isFolder: { $ne: true } } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

    const data = folders.map((f) => ({
      ...f,
      documentCount: countMap[f._id.toString()] || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const folder = await FinanceDocument.findOne({ _id: req.params.folderId, isFolder: true });
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const childDocs = await FinanceDocument.find({ folderId: folder._id, isFolder: { $ne: true } });
    for (const doc of childDocs) {
      if (doc.fileKey) {
        try {
          await utapi.deleteFiles(doc.fileKey);
        } catch (err) {
          console.error('UploadThing delete failed:', err.message);
        }
      }
    }

    await FinanceDocument.deleteMany({ folderId: folder._id });
    await folder.deleteOne();

    res.json({ success: true, message: 'Folder and documents deleted' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const syncFolderPlacementFromDiskHandler = async (req, res) => {
  try {
    const { syncFolderPlacementFromDisk } = require('../utils/financeDiskSync');
    const results = await syncFolderPlacementFromDisk(req.user._id);
    res.json({ success: true, data: results, message: 'Folder placement synced from disk' });
  } catch (error) {
    console.error('Sync folder placement error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

const getFolderBreadcrumb = async (req, res) => {
  try {
    const { folderId } = req.params;
    const trail = [];
    let current = await FinanceDocument.findOne({ _id: folderId, isFolder: true })
      .populate('project', 'name')
      .lean();

    if (!current) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    while (current) {
      trail.unshift({
        _id: current._id,
        folderName: current.folderName,
        project: current.project,
      });
      if (!current.parentFolderId) break;
      current = await FinanceDocument.findOne({ _id: current.parentFolderId, isFolder: true })
        .populate('project', 'name')
        .lean();
    }

    res.json({ success: true, data: trail });
  } catch (error) {
    console.error('Breadcrumb error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await FinanceDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (doc.isFolder) {
      return res.status(400).json({ success: false, message: 'Use folder delete endpoint for folders' });
    }

    if (!isAdminUser(req.user) && doc.uploadedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    if (doc.fileKey) {
      try {
        await utapi.deleteFiles(doc.fileKey);
      } catch (err) {
        console.error('UploadThing delete failed:', err.message);
      }
    }

    await doc.deleteOne();
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await FinanceDocument.aggregate([
      { $match: { isFolder: { $ne: true } } },
      {
        $facet: {
          totalDocs: [{ $count: 'count' }],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          byProject: [
            {
              $group: {
                _id: '$project',
                count: { $sum: 1 },
                totalSize: { $sum: { $ifNull: ['$fileSize', 0] } }
              }
            },
            {
              $lookup: {
                from: 'projects',
                localField: '_id',
                foreignField: '_id',
                as: 'projectInfo'
              }
            },
            { $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                projectName: { $ifNull: ['$projectInfo.name', 'Unknown'] },
                count: 1,
                totalSize: 1
              }
            }
          ],
          totalSize: [
            { $group: { _id: null, total: { $sum: { $ifNull: ['$fileSize', 0] } } } }
          ]
        }
      }
    ]);

    const result = stats[0];
    res.json({
      success: true,
      data: {
        totalDocuments: result.totalDocs[0]?.count || 0,
        totalSize: result.totalSize[0]?.total || 0,
        byCategory: result.byCategory,
        byProject: result.byProject
      }
    });
  } catch (error) {
    console.error('Finance stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const canManageFinanceDoc = (user, doc) => (
  isOpsUser(user)
  || doc.uploadedBy?.toString() === user._id.toString()
);

const updateDocument = async (req, res) => {
  try {
    const { title, description, project, category, metadata } = req.body;
    const doc = await FinanceDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!canManageFinanceDoc(req.user, doc)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this document' });
    }

    if (title !== undefined) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (project !== undefined) doc.project = project || null;
    if (category !== undefined) doc.category = category;
    if (metadata) {
      doc.metadata = { ...(doc.metadata?.toObject?.() || doc.metadata || {}), ...metadata };
    }

    await doc.save();

    const populated = await populateFinanceDoc(doc._id);

    res.json({ success: true, data: populated, message: 'Document updated' });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const submitInvoice = async (req, res) => {
  try {
    const { title, amount, description, fileUrl, fileKey, fileName, fileSize, fileType } = req.body;

    if (!title || !fileUrl) {
      return res.status(400).json({ success: false, message: 'Title and file are required' });
    }

    const doc = new FinanceDocument({
      title,
      description: description || '',
      category: 'invoice',
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      fileType,
      uploadedBy: req.user._id,
      submittedBy: req.user._id,
      approvalStatus: 'pending',
      metadata: {
        amount: Number(amount) || 0,
        currency: 'INR',
      },
    });

    await doc.save();

    queueGamificationEvent('INVOICE_SUBMITTED', {
      userId: req.user._id,
      invoice: { _id: doc._id },
    });

    const populated = await FinanceDocument.findById(doc._id)
      .populate('uploadedBy', 'name email avatar')
      .populate('submittedBy', 'name email avatar')
      .lean();

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Invoice submitted for approval',
    });
  } catch (error) {
    console.error('Submit invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listPendingInvoices = async (req, res) => {
  try {
    const docs = await FinanceDocument.find({ approvalStatus: 'pending', category: 'invoice' })
      .populate('uploadedBy', 'name email avatar')
      .populate('submittedBy', 'name email avatar')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('List pending invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const applyPendingInvoiceEdits = (doc, body) => {
  const { title, description, project, category, metadata, folderId } = body || {};
  if (title !== undefined) doc.title = String(title).trim();
  if (description !== undefined) doc.description = String(description).trim();
  if (project !== undefined) doc.project = project || null;
  if (category !== undefined) doc.category = category;
  if (folderId !== undefined) doc.folderId = folderId || null;
  if (metadata && typeof metadata === 'object') {
    const base = doc.metadata?.toObject?.() || doc.metadata || {};
    doc.metadata = { ...base, ...metadata };
    if (metadata.amount !== undefined) doc.metadata.amount = Number(metadata.amount) || 0;
    if (metadata.tax !== undefined) doc.metadata.tax = Number(metadata.tax) || 0;
    if (metadata.date) doc.metadata.date = new Date(metadata.date);
  }
};

const approveInvoice = async (req, res) => {
  try {
    const doc = await FinanceDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (doc.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invoice already processed' });
    }

    applyPendingInvoiceEdits(doc, req.body);
    if (!doc.title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    doc.approvalStatus = 'approved';
    doc.reviewedBy = req.user._id;
    doc.reviewedAt = new Date();
    doc.rejectionReason = '';
    await doc.save();

    const populated = await FinanceDocument.findById(doc._id)
      .populate('uploadedBy', 'name email avatar')
      .populate('submittedBy', 'name email avatar')
      .populate('reviewedBy', 'name email avatar')
      .populate('project', 'name')
      .lean();

    res.json({ success: true, data: populated, message: 'Invoice approved' });
  } catch (error) {
    console.error('Approve invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const rejectInvoice = async (req, res) => {
  try {
    const doc = await FinanceDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (doc.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invoice already processed' });
    }

    doc.approvalStatus = 'rejected';
    doc.reviewedBy = req.user._id;
    doc.reviewedAt = new Date();
    doc.rejectionReason = req.body?.rejectionReason || req.body?.reason || '';
    await doc.save();

    const populated = await FinanceDocument.findById(doc._id)
      .populate('uploadedBy', 'name email avatar')
      .populate('submittedBy', 'name email avatar')
      .populate('reviewedBy', 'name email avatar')
      .lean();

    res.json({ success: true, data: populated, message: 'Invoice rejected' });
  } catch (error) {
    console.error('Reject invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  uploadFile,
  uploadFilesMany,
  uploadDocument,
  getDocuments,
  deleteDocument,
  getStats,
  uploadDocumentsBulk,
  updateDocument,
  submitInvoice,
  listPendingInvoices,
  approveInvoice,
  rejectInvoice,
  createFolder,
  getFolders,
  deleteFolder,
  getFolderBreadcrumb,
  syncFolderPlacementFromDiskHandler,
};
