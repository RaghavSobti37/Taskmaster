const express = require('express');
const router = express.Router();
const { protect, orgAccountsAccess } = require('../middleware/authMiddleware');
const {
  listOrgAccounts,
  getOrgAccount,
  createOrgAccount,
  updateOrgAccount,
  deleteOrgAccount,
  importOrgAccountsFromSheet,
} = require('../controllers/orgAccountController');

router.use(protect);

router.post('/import-sheet', orgAccountsAccess, importOrgAccountsFromSheet);
router.get('/', orgAccountsAccess, listOrgAccounts);
router.get('/:id', orgAccountsAccess, getOrgAccount);
router.post('/', orgAccountsAccess, createOrgAccount);
router.put('/:id', orgAccountsAccess, updateOrgAccount);
router.delete('/:id', orgAccountsAccess, deleteOrgAccount);

module.exports = router;
