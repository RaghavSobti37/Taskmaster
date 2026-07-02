const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { listTenants, updateTenant, exportTenant, deleteTenant } = require('../controllers/tenantAdminController');
const { auditSensitiveMutation } = require('../services/securityAuditService');

const router = express.Router();
const adminAccess = requirePageAccess('admin_users');

router.use(protect, adminAccess);

router.get('/', listTenants);
router.post('/:id/export', auditSensitiveMutation({ resourceType: 'Tenant', action: 'EXPORT' }), exportTenant);
router.post('/:id/delete', auditSensitiveMutation({ resourceType: 'Tenant', action: 'DELETE' }), deleteTenant);
router.patch('/:id', auditSensitiveMutation({ resourceType: 'Tenant', action: 'UPDATE' }), updateTenant);

module.exports = router;
