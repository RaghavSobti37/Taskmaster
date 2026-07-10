/**
 * API v1 — stable integration surface. Handlers re-use existing controllers.
 */
const express = require('express');
const { protect, requirePageAccess } = require('../../middleware/authMiddleware');
const { getMe } = require('../../domains/auth/controllers/authController');
const SystemHealthService = require('../../services/SystemHealthService');
const { apiOk, apiError } = require('../../utils/apiResponse');
const { getProjects } = require('../../domains/projects/controllers/projectController');
const crmController = require('../../domains/crm/controllers/crmController');

const router = express.Router();
const projectsAccess = requirePageAccess('projects');
const leadsAccess = requirePageAccess('leads');

router.use((req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('Deprecation', 'false');
  next();
});

router.get('/health', (_req, res) => {
  const detail = SystemHealthService.getDetailedStatus();
  const healthy = detail.status === 'HEALTHY' || detail.status === 'STARTING';
  const payload = {
    status: detail.status,
    reason: detail.reason || null,
    dependencies: detail.dependencies,
    uptimeSeconds: detail.uptimeSeconds,
    apiVersion: 'v1',
  };
  if (healthy) return apiOk(res, payload, 200);
  return apiError(res, detail.reason || 'Service unhealthy', 503, payload);
});

router.get('/auth/me', protect, getMe);

router.get('/projects', protect, projectsAccess, getProjects);
router.get('/crm/leads', protect, leadsAccess, crmController.getLeads);

module.exports = router;
