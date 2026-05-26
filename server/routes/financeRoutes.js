const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadFile, uploadDocument, getDocuments, deleteDocument, getStats, uploadDocumentsBulk, updateDocument } = require('../controllers/financeController');

// Multer: memory storage for server-side UTApi upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 }, // 32MB max
});

// Role gate: only ops or admin
const opsOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'ops' || req.user.role === 'admin' || req.user.role === 'operations' || req.user.role === 'Operations')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized for Finance/Ops' });
  }
};

router.use(protect, opsOnly);

// File upload to UploadThing CDN (server-side, bypasses React version mismatch)
router.post('/upload', upload.single('file'), uploadFile);

router.post('/bulk', uploadDocumentsBulk);

router.route('/')
  .post(uploadDocument)
  .get(getDocuments);

router.get('/stats', getStats);

router.route('/:id')
  .patch(updateDocument)
  .delete(deleteDocument);

module.exports = router;
