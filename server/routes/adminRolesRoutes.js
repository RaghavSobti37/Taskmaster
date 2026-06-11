const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const rolesAccess = requirePageAccess('admin_roles');
const adminRolesService = require('../services/adminRolesService');
const logger = require('../utils/logger');

router.use(protect, rolesAccess);

router.get('/', async (req, res) => {
  try {
    res.json(await adminRolesService.listRoles());
  } catch (err) {
    logger.error('adminRoles', 'list error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const role = await adminRolesService.createOrgRole(req.body);
    res.status(201).json(role);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const role = await adminRolesService.updateOrgRole(req.params.id, req.body);
    res.json(role);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await adminRolesService.deleteOrgRole(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
