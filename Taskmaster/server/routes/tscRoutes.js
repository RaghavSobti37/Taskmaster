const express = require('express');
const router = express.Router();
const tscController = require('../controllers/tscController');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const dataHubAccess = requirePageAccess('admin_data');
const { uploadRateLimit } = require('../middleware/rateLimits');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `tsc-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/', protect, dataHubAccess, tscController.getTscData);
router.get('/stats', protect, dataHubAccess, tscController.getTscStats);
router.post('/upload', protect, dataHubAccess, uploadRateLimit, upload.single('file'), tscController.uploadTscFile);
router.post('/import', protect, dataHubAccess, tscController.importTscData);
router.post('/bulk-delete', protect, dataHubAccess, tscController.bulkDeleteTscData);
router.delete('/import/:id', protect, dataHubAccess, tscController.deleteTscImport);

module.exports = router;
