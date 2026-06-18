const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const { isAdminUser, isOpsUser } = require('../utils/departmentPermissions');
const { scheduleFinanceDocumentOcr } = require('../utils/financeOcr');
const { queueGamificationEvent } = require('../services/backgroundQueue');
const { getNextReferenceNumbers, createReferenceAllocator } = require('../services/financeReferenceService');
const {
  utapi,
  handleUploadFilesManyRequest,
  handleUploadSingleRequest,
} = require('../utils/uploadthingServer');

const populateFinanceDoc = (id) =>
  FinanceDocument.findById(id)
    .populate('uploadedBy', 'name email avatar')
    .populate('project', 'name')
    .populate('folderId', 'folderName title isFolder')
    .lean();

const uploadFile = handleUploadSingleRequest;
const uploadFilesMany = handleUploadFilesManyRequest;


const uploadDocument = async (req, res) => {
  try {
    const { title, description, project, category, fileUrl, fileKey, fileName, fileSize, fileType, folderId, referenceNumber } = req.body;

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

    let docReference = (referenceNumber || '').trim();
    if (!docReference) {
      [docReference] = await getNextReferenceNumbers(project, 1);
    }

    const doc = new FinanceDocument({
      title,
      description: description || '',
      project,
      folderId: folderId || null,
      category: category || 'other',
      referenceNumber: docReference,
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      fileType,
      uploadedBy: req.user._id,
      extractedText: '',
      metadata: {
        amount: 0,
        currency: 'INR',
        vendor: '',
        date: null,
        tax: 0,
        detectedCategory: category || 'other',
      },
    });

    await doc.save();

    scheduleFinanceDocumentOcr(doc._id, { fileUrl, fileType, fileName, fileSize });

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
    const { allocate: allocateReference } = createReferenceAllocator();

    for (const d of documents) {
      const { title, description, project, category, fileUrl, fileKey, fileName, fileSize, fileType, folderId, referenceNumber } = d;
      if (!title || !project || !fileUrl) continue;

      if (folderId) {
        const folder = await FinanceDocument.findOne({ _id: folderId, isFolder: true, project });
        if (!folder) continue;
      }

      const docReference = await allocateReference(project, referenceNumber);

      const doc = new FinanceDocument({
        title,
        description: description || '',
        project,
        folderId: folderId || null,
        category: category || 'other',
        referenceNumber: docReference,
        fileUrl,
        fileKey,
        fileName,
        fileSize,
        fileType,
        uploadedBy: req.user._id,
        extractedText: '',
        metadata: {
          amount: 0,
          currency: 'INR',
          vendor: '',
          date: null,
          tax: 0,
          detectedCategory: category || 'other',
        },
      });

      await doc.save();
      scheduleFinanceDocumentOcr(doc._id, { fileUrl, fileType, fileName, fileSize });
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
        { referenceNumber: regex },
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

    const categoryMixRows = await FinanceDocument.aggregate([
      { $match: filter },
      { $match: { isFolder: { $ne: true } } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$metadata.submissionType', 'reimbursement'] },
              'reimbursements',
              { $ifNull: ['$category', 'other'] },
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const categoryMix = categoryMixRows.map((row) => ({
      key: row._id,
      count: row.count,
    }));

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
      categoryMix,
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

const loadFinanceDocForMutation = async (req, res, notFoundMessage = 'Invoice not found') => {
  const doc = await FinanceDocument.findOne({ _id: req.params.id });
  if (doc) return doc;
  res.status(404).json({ success: false, message: notFoundMessage });
  return null;
};

const updateDocument = async (req, res) => {
  try {
    const { title, description, project, category, metadata, referenceNumber } = req.body;
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
    if (referenceNumber !== undefined) doc.referenceNumber = String(referenceNumber || '').trim();
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
    const {
      title,
      amount,
      description,
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      fileType,
      project,
      attachments: attachmentsBody,
      metadata: metadataBody,
    } = req.body;

    const submissionType = metadataBody?.submissionType === 'reimbursement' ? 'reimbursement' : 'invoice';
    const normalizedAttachments = Array.isArray(attachmentsBody)
      ? attachmentsBody
        .filter((item) => item?.fileUrl)
        .map((item) => ({
          fileUrl: item.fileUrl,
          fileKey: item.fileKey,
          fileName: item.fileName,
          fileSize: item.fileSize,
          fileType: item.fileType,
        }))
      : [];

    const primaryFromAttachments = normalizedAttachments[0];
    const resolvedFileUrl = fileUrl || primaryFromAttachments?.fileUrl;

    if (!title || !resolvedFileUrl) {
      return res.status(400).json({ success: false, message: 'Title and at least one file are required' });
    }

    const parsedAmount = Number(metadataBody?.amount ?? amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid invoice amount (INR) is required' });
    }

    if (submissionType === 'reimbursement' && !metadataBody?.date) {
      return res.status(400).json({ success: false, message: 'Expense date is required' });
    }

    const doc = new FinanceDocument({
      title: String(title).trim(),
      description: description || '',
      category: 'invoice',
      project: project || null,
      fileUrl: resolvedFileUrl,
      fileKey: fileKey || primaryFromAttachments?.fileKey,
      fileName: fileName || primaryFromAttachments?.fileName,
      fileSize: fileSize ?? primaryFromAttachments?.fileSize,
      fileType: fileType || primaryFromAttachments?.fileType,
      uploadedBy: req.user._id,
      submittedBy: req.user._id,
      approvalStatus: 'pending',
      metadata: {
        amount: parsedAmount,
        currency: metadataBody?.currency || 'INR',
        vendor: metadataBody?.vendor ? String(metadataBody.vendor).trim() : '',
        tax: Number(metadataBody?.tax) || 0,
        date: metadataBody?.date ? new Date(metadataBody.date) : null,
        detectedCategory: 'invoice',
        submissionType,
        attachments: normalizedAttachments.length > 0
          ? normalizedAttachments
          : [{
            fileUrl: resolvedFileUrl,
            fileKey: fileKey || primaryFromAttachments?.fileKey,
            fileName: fileName || primaryFromAttachments?.fileName,
            fileSize: fileSize ?? primaryFromAttachments?.fileSize,
            fileType: fileType || primaryFromAttachments?.fileType,
          }],
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

const listMyInvoices = async (req, res) => {
  try {
    const filter = { submittedBy: req.user._id, category: 'invoice' };
    if (req.query.submissionType === 'reimbursement') {
      filter['metadata.submissionType'] = 'reimbursement';
    } else if (req.query.submissionType === 'invoice') {
      filter.$or = [
        { 'metadata.submissionType': 'invoice' },
        { 'metadata.submissionType': { $exists: false } },
      ];
    }

    const docs = await FinanceDocument.find(filter)
      .populate('uploadedBy', 'name email avatar')
      .populate('submittedBy', 'name email avatar')
      .populate('reviewedBy', 'name email avatar')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('List my invoices error:', error);
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
    const doc = await loadFinanceDocForMutation(req, res);
    if (!doc) return;
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
    const doc = await loadFinanceDocForMutation(req, res);
    if (!doc) return;
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

const getNextReference = async (req, res) => {
  try {
    const { project, count } = req.query;
    if (!project) {
      return res.status(400).json({ success: false, message: 'project is required' });
    }

    const references = await getNextReferenceNumbers(project, count || 1);
    const prefix = references[0]?.replace(/-\d+$/, '') || null;

    res.json({
      success: true,
      data: { prefix, references },
    });
  } catch (error) {
    console.error('Next reference error:', error);
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
  getNextReference,
  submitInvoice,
  listPendingInvoices,
  listMyInvoices,
  approveInvoice,
  rejectInvoice,
  createFolder,
  getFolders,
  deleteFolder,
  getFolderBreadcrumb,
  syncFolderPlacementFromDiskHandler,
};
