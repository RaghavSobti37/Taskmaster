const express = require('express');
const router = express.Router();
const tscController = require('../controllers/tscController');
const { protect, admin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `tsc-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/', protect, admin, tscController.getTscData);
router.get('/stats', protect, admin, tscController.getTscStats);
router.post('/upload', protect, admin, upload.single('file'), tscController.uploadTscFile);
router.post('/import', protect, admin, tscController.importTscData);
router.post('/bulk-delete', protect, admin, tscController.bulkDeleteTscData);
router.delete('/import/:id', protect, admin, tscController.deleteTscImport);

module.exports = router;
