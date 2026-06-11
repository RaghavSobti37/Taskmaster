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
  listMyInvoices,
  approveInvoice,
  rejectInvoice,
  createFolder,
  getFolders,
  deleteFolder,
  getFolderBreadcrumb,
  syncFolderPlacementFromDiskHandler,
} = require('../controllers/financeController');
const { getUsdInrRate } = require('../controllers/subscriptionController');

// Multer: memory storage for server-side UTApi upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024, files: 12 },
});

const { isOpsUser, hasPageAccess } = require('../utils/departmentPermissions');
const { validateBody } = require('../validation/validateBody');
const { submitInvoiceBody, createFolderBody } = require('../validation/schemas/finance');
const { uploadRateLimit } = require('../middleware/rateLimits');

// Department gate: ops/admin or explicit finance page permission
const financeAccess = (req, res, next) => {
  const allowed = req.user && (isOpsUser(req.user) || hasPageAccess(req.user, 'finance'));
  if (allowed) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized for Finance/Ops' });
  }
};
const opsOnly = financeAccess;

router.use(protect);

router.get('/usd-inr-rate', getUsdInrRate);

// Any authenticated user can submit an invoice for ops review
router.post('/submit-invoice', validateBody(submitInvoiceBody), submitInvoice);
router.get('/my-invoices', listMyInvoices);
router.post('/upload-invoice', uploadRateLimit, upload.single('file'), uploadFile);

// Ops-only invoice review routes (before /:id catch-all)
router.get('/pending', financeAccess, listPendingInvoices);
router.patch('/:id/approve', opsOnly, approveInvoice);
router.patch('/:id/reject', opsOnly, rejectInvoice);

// Remaining finance routes require finance page access or ops role
router.use(financeAccess);

router.post('/upload', uploadRateLimit, upload.single('file'), uploadFile);
router.post('/upload-many', uploadRateLimit, (req, res, next) => {
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
router.post('/folders', validateBody(createFolderBody), createFolder);
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
