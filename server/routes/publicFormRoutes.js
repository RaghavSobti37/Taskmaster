const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const asyncHandler = require('../middleware/asyncHandler');
const {
  getFormByPublishableKey,
  originAllowed,
} = require('../domains/forms/services/websiteFormService');
const User = require('../models/User');
const { createLeadFromForm } = require('../domains/crm/services/leadWriteService');
const { config } = require('../config');

const router = express.Router();

const formSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.isProduction ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many form submissions. Try again later.' },
  keyGenerator: (req) => `form:${req.params.publishableKey || 'unknown'}:${ipKeyGenerator(req)}`,
});

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

async function appendLeadToGoogleSheet(form, lead) {
  const integrationId = form.metadata?.googleSheetsIntegrationId;
  if (!integrationId) return;
  try {
    const TenantIntegration = require('../domains/integrations-hub/models/TenantIntegration');
    const { unpackCredentials } = require('../domains/integrations-hub/services/integrationCredentialService');
    const googleSheetsAdapter = require('../domains/integrations-hub/adapters/googleSheetsAdapter');
    const doc = await TenantIntegration.findOne({
      _id: integrationId,
      tenantId: form.tenantId,
      provider: 'google_sheets',
      status: 'connected',
    })
      .select('+credentialsEncrypted')
      .setOptions({ bypassTenant: true });
    if (!doc) return;
    const credentials = unpackCredentials(doc.credentialsEncrypted);
    const spreadsheetId = googleSheetsAdapter.parseSpreadsheetId(doc.metadata?.spreadsheetId)
      || googleSheetsAdapter.parseSpreadsheetId(doc.metadata?.spreadsheetUrl);
    const sheetName = doc.metadata?.sheetName || 'Leads';
    if (!spreadsheetId) return;
    await googleSheetsAdapter.appendRow(credentials, spreadsheetId, sheetName, [
      new Date().toISOString(),
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.source || '',
      lead.remarks || '',
    ]);
  } catch {
    // ponytail: sheet append is best-effort
  }
}

router.options(
  '/:publishableKey/submit',
  formSubmitLimiter,
  asyncHandler(async (req, res) => {
    const form = await getFormByPublishableKey(req.params.publishableKey);
    const origin = req.headers.origin;
    if (!form || (origin && !originAllowed(form, origin))) {
      return res.status(403).end();
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CoreKnot-Form-Key');
      res.setHeader('Vary', 'Origin');
    }
    return res.status(204).end();
  }),
);

router.post(
  '/:publishableKey/submit',
  formSubmitLimiter,
  express.json({ limit: '32kb' }),
  express.urlencoded({ extended: true, limit: '32kb' }),
  asyncHandler(async (req, res) => {
    const form = await getFormByPublishableKey(req.params.publishableKey);
    if (!form) {
      return res.status(404).json({ ok: false, error: 'Form not found' });
    }

    const origin = req.headers.origin;
    if (origin && !originAllowed(form, origin)) {
      return res.status(403).json({ ok: false, error: 'Origin not allowed' });
    }

    const payload = parseBody(req);
    const honeypot = form.honeypotField || '_gotcha';
    if (payload[honeypot]) {
      return res.status(400).json({ ok: false, error: 'Invalid submission' });
    }

    const systemUser = await User.findOne({ tenantId: form.tenantId })
      .setOptions({ bypassTenant: true })
      .sort({ createdAt: 1 });
    if (!systemUser) {
      return res.status(500).json({ ok: false, error: 'Form unavailable' });
    }

    const fields = form.fields || {};
    const leadBody = {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      message: payload.message,
      company: payload.company,
      source: form.defaults?.source || 'Website Form',
      leadStatus: form.defaults?.leadStatus || 'New',
      crmType: form.defaults?.crmType || 'sales',
    };

    if (fields.name?.required && !leadBody.name) {
      return res.status(400).json({ ok: false, error: 'name is required' });
    }
    if (fields.email?.required && !leadBody.email) {
      return res.status(400).json({ ok: false, error: 'email is required' });
    }
    if (fields.phone?.required && !leadBody.phone) {
      return res.status(400).json({ ok: false, error: 'phone is required' });
    }
    if (!leadBody.email && !leadBody.phone) {
      return res.status(400).json({ ok: false, error: 'email or phone required' });
    }
    if (!leadBody.name) {
      leadBody.name = leadBody.email || leadBody.phone || 'Website Lead';
    }

    const result = await createLeadFromForm(systemUser, leadBody, {
      defaultSource: form.defaults?.source,
      defaultLeadStatus: form.defaults?.leadStatus,
      defaultCrmType: form.defaults?.crmType,
    });

    if (result.error) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    await appendLeadToGoogleSheet(form, result.lead);

    return res.status(result.created ? 201 : 200).json({
      ok: true,
      leadId: result.lead?._id,
      created: !!result.created,
    });
  }),
);

module.exports = router;
