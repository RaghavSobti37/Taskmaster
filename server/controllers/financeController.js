const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const { UTApi, UTFile } = require('uploadthing/server');
const axios = require('axios');
const { parseDocument } = require('../utils/documentParser');

// Extract sk_ API key from base64 UPLOADTHING_TOKEN
let utApiKey;
try {
  const tokenData = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN || '', 'base64').toString());
  utApiKey = tokenData.apiKey;
} catch { utApiKey = process.env.UPLOADTHING_SECRET; }

const utapi = new UTApi({ apiKey: utApiKey });

// Direct file upload via server-side UTApi (bypasses React client version issues)
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

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


const uploadDocument = async (req, res) => {
  try {
    const { title, description, project, category, fileUrl, fileKey, fileName, fileSize, fileType } = req.body;

    if (!title || !project || !fileUrl) {
      return res.status(400).json({ success: false, message: 'Title, project, and file URL are required' });
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

    // Return populated doc
    const populated = await FinanceDocument.findById(doc._id)
      .populate('uploadedBy', 'name email avatar')
      .populate('project', 'name')
      .lean();

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
      const { title, description, project, category, fileUrl, fileKey, fileName, fileSize, fileType } = d;
      if (!title || !project || !fileUrl) continue;

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
    const { project, category, page, limit, startDate, endDate, searchQuery } = req.query;
    const filter = {};
    
    if (project) filter.project = project;
    if (category && category !== 'all') filter.category = category;
    
    // Date Range Filter (based on upload date or receipt metadata date - we filter by upload date)
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Search Query (scans title, fileName, and vendor metadata field)
    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'i');
      filter.$or = [
        { title: regex },
        { fileName: regex },
        { 'metadata.vendor': regex }
      ];
    }

    // Pagination
    const pageVal = parseInt(page) || 1;
    const limitVal = parseInt(limit) || 10;
    const skip = (pageVal - 1) * limitVal;

    const total = await FinanceDocument.countDocuments(filter);
    
    const docs = await FinanceDocument.find(filter)
      .populate('uploadedBy', 'name email avatar')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitVal)
      .lean();

    res.json({
      success: true,
      data: docs,
      pagination: {
        total,
        page: pageVal,
        limit: limitVal,
        pages: Math.ceil(total / limitVal)
      }
    });
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await FinanceDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Only uploader or admin can delete
    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
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

const updateDocument = async (req, res) => {
  try {
    const { title, description, project, category, metadata } = req.body;
    const doc = await FinanceDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Only admin or uploader can edit
    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this document' });
    }

    if (title) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (project) doc.project = project;
    if (category) doc.category = category;
    if (metadata) {
      doc.metadata = { ...doc.metadata, ...metadata };
    }

    await doc.save();

    const populated = await FinanceDocument.findById(doc._id)
      .populate('uploadedBy', 'name email avatar')
      .populate('project', 'name')
      .lean();

    res.json({ success: true, data: populated, message: 'Document updated' });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  uploadFile,
  uploadDocument,
  getDocuments,
  deleteDocument,
  getStats,
  uploadDocumentsBulk,
  updateDocument
};
