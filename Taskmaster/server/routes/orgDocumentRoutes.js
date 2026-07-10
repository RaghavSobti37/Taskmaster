const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  streamDocumentFile,
} = require('../controllers/orgDocumentController');

router.use(protect, requirePageAccess('org_documents'));

router.get('/', listDocuments);
router.post('/', createDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);
router.get('/:id/file', streamDocumentFile);

module.exports = router;
