const express = require('express');
const { protect } = require('../../../middleware/authMiddleware');
const asyncHandler = require('../../../middleware/asyncHandler');
const {
  listForms,
  createForm,
  updateForm,
  rotateFormKey,
  deleteForm,
  buildAgentPrompt,
  getFormById,
} = require('../services/websiteFormService');

const router = express.Router();

function requireTenantAdmin(req, res, next) {
  const role = req.user?.role;
  if (!['admin', 'owner', 'org_admin', 'superadmin'].includes(role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

function apiBase(req) {
  const envBase = process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL;
  if (envBase) return String(envBase).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

router.use(protect, requireTenantAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const forms = await listForms(req.user.tenantId);
    res.json({ forms });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, allowedOrigins, fields, defaults } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    const form = await createForm({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      name,
      allowedOrigins,
      fields,
      defaults,
    });
    res.status(201).json({ form });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await getFormById({ tenantId: req.user.tenantId, formId: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Form not found' });
    res.json({ form: doc });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const form = await updateForm({
      tenantId: req.user.tenantId,
      formId: req.params.id,
      patch: req.body || {},
    });
    res.json({ form });
  }),
);

router.post(
  '/:id/rotate-key',
  asyncHandler(async (req, res) => {
    const result = await rotateFormKey({ tenantId: req.user.tenantId, formId: req.params.id });
    res.json(result);
  }),
);

router.get(
  '/:id/agent-prompt',
  asyncHandler(async (req, res) => {
    const doc = await getFormById({ tenantId: req.user.tenantId, formId: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Form not found' });
    const prompt = buildAgentPrompt({ form: doc, apiBase: apiBase(req) });
    res.json({ prompt });
  }),
);

router.post(
  '/:id/test',
  asyncHandler(async (req, res) => {
    const doc = await getFormById({ tenantId: req.user.tenantId, formId: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Form not found' });
    const base = apiBase(req);
    const url = `${base}/api/public/forms/${doc.publishableKey}/submit`;
    const axios = require('axios');
    const { data } = await axios.post(url, {
      name: 'CoreKnot Test',
      email: `form-test+${Date.now()}@coreknot.local`,
      message: 'Test submission from CoreKnot settings',
    }, { validateStatus: () => true });
    res.json({ url, response: data });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteForm({ tenantId: req.user.tenantId, formId: req.params.id });
    res.json({ success: true });
  }),
);

module.exports = router;
