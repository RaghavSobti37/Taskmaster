const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/financeController');

// Multer: memory storage for server-side UTApi upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024, files: 12 },
});

const { isOpsUser } = require('../utils/departmentPermissions');

// Department gate: ops or admin
const opsOnly = (req, res, next) => {
  if (req.user && isOpsUser(req.user)) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized for Finance/Ops' });
  }
};

router.use(protect);

// Any authenticated user can submit an invoice for ops review
router.post('/submit-invoice', submitInvoice);

// Ops-only invoice review routes (before /:id catch-all)
router.get('/pending', opsOnly, listPendingInvoices);
router.patch('/:id/approve', opsOnly, approveInvoice);
router.patch('/:id/reject', opsOnly, rejectInvoice);

// Remaining finance routes require ops role
router.use(opsOnly);

router.post('/upload', upload.single('file'), uploadFile);
router.post('/upload-many', (req, res, next) => {
  upload.array('files', 12)(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files in one batch (max 12). Upload in smaller groups.',
      });
    }
    if (err) return next(err);
    return uploadFilesMany(req, res);
  });
});
router.post('/bulk', uploadDocumentsBulk);

router.post('/sync-folder-placement', syncFolderPlacementFromDiskHandler);
router.post('/reorganize-folders', syncFolderPlacementFromDiskHandler);
router.post('/folders', createFolder);
router.get('/folders', getFolders);
router.get('/folders/:folderId/breadcrumb', getFolderBreadcrumb);
router.delete('/folders/:folderId', deleteFolder);

router.route('/')
  .post(uploadDocument)
  .get(getDocuments);

router.get('/stats', getStats);

router.route('/:id')
  .patch(updateDocument)
  .delete(deleteDocument);

module.exports = router;
