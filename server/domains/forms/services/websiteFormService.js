const crypto = require('crypto');
const WebsiteForm = require('../models/WebsiteForm');

function generatePublishableKey() {
  const raw = crypto.randomBytes(24).toString('base64url');
  return { key: `ckf_live_${raw}`, prefix: `ckf_live_${raw.slice(0, 8)}` };
}

function slugify(name) {
  return String(name || 'form')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'form';
}

function serializeForm(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    _id: o._id,
    name: o.name,
    slug: o.slug,
    publishableKey: o.publishableKey,
    keyPrefix: o.keyPrefix,
    allowedOrigins: o.allowedOrigins || [],
    fields: o.fields,
    defaults: o.defaults,
    honeypotField: o.honeypotField,
    status: o.status,
    metadata: o.metadata,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function listForms(tenantId) {
  const rows = await WebsiteForm.find({ tenantId }).sort({ createdAt: -1 }).setOptions({ bypassTenant: true });
  return rows.map(serializeForm);
}

async function getFormById({ tenantId, formId }) {
  const doc = await WebsiteForm.findOne({ _id: formId, tenantId }).setOptions({ bypassTenant: true });
  return serializeForm(doc);
}

async function getFormByPublishableKey(publishableKey) {
  return WebsiteForm.findOne({ publishableKey, status: 'active' }).setOptions({ bypassTenant: true });
}

async function createForm({ tenantId, userId, name, allowedOrigins = [], fields, defaults }) {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let n = 1;
  while (await WebsiteForm.findOne({ tenantId, slug }).setOptions({ bypassTenant: true })) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  const { key, prefix } = generatePublishableKey();
  const doc = await WebsiteForm.create({
    tenantId,
    name: name.trim(),
    slug,
    publishableKey: key,
    keyPrefix: prefix,
    allowedOrigins: (allowedOrigins || []).map((o) => String(o).trim()).filter(Boolean),
    fields: fields || undefined,
    defaults: defaults || undefined,
    createdBy: userId,
  });
  return serializeForm(doc);
}

async function updateForm({ tenantId, formId, patch }) {
  const doc = await WebsiteForm.findOne({ _id: formId, tenantId }).setOptions({ bypassTenant: true });
  if (!doc) {
    const err = new Error('Form not found');
    err.status = 404;
    throw err;
  }
  const allowed = ['name', 'allowedOrigins', 'fields', 'defaults', 'honeypotField', 'status', 'metadata'];
  for (const key of allowed) {
    if (patch[key] !== undefined) doc[key] = patch[key];
  }
  await doc.save();
  return serializeForm(doc);
}

async function rotateFormKey({ tenantId, formId }) {
  const doc = await WebsiteForm.findOne({ _id: formId, tenantId }).setOptions({ bypassTenant: true });
  if (!doc) {
    const err = new Error('Form not found');
    err.status = 404;
    throw err;
  }
  const { key, prefix } = generatePublishableKey();
  doc.publishableKey = key;
  doc.keyPrefix = prefix;
  await doc.save();
  return { form: serializeForm(doc), publishableKey: key };
}

async function deleteForm({ tenantId, formId }) {
  const result = await WebsiteForm.deleteOne({ _id: formId, tenantId }).setOptions({ bypassTenant: true });
  if (!result.deletedCount) {
    const err = new Error('Form not found');
    err.status = 404;
    throw err;
  }
  return { success: true };
}

function originAllowed(form, origin) {
  if (!origin) return true;
  const list = form.allowedOrigins || [];
  if (!list.length) return false;
  return list.some((allowed) => {
    const a = String(allowed).trim().toLowerCase();
    const o = String(origin).trim().toLowerCase();
    return a === o;
  });
}

function buildAgentPrompt({ form, apiBase }) {
  const base = apiBase.replace(/\/$/, '');
  const origins = (form.allowedOrigins || []).join(', ') || '(add allowed origins in CoreKnot)';
  return `# CoreKnot Website Form — agent setup

Wire a contact form on this website to CoreKnot CRM.

## Credentials (safe for browser)
- **Publishable form key:** \`${form.publishableKey}\`
- **Submit URL:** \`${base}/api/public/forms/${form.publishableKey}/submit\`
- **Allowed origins (must match this site):** ${origins}

## Never put in frontend
- Inbound webhook HMAC secret (\`whin_*\`)
- API keys (\`ck_live_*\`)

## Embed (fastest)
\`\`\`html
<form id="contact-form">
  <input name="name" required placeholder="Name" />
  <input name="email" type="email" placeholder="Email" />
  <input name="phone" type="tel" placeholder="Phone" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>
<script src="${base}/embed/coreknot-form.js" data-form-key="${form.publishableKey}" data-target="#contact-form"></script>
\`\`\`

## Manual fetch (React/Next/Vanilla)
POST JSON to submit URL with \`Content-Type: application/json\`:
\`{ "name", "email", "phone", "message", "company" }\`
At least **email or phone** required. Hidden honeypot field \`${form.honeypotField}\` must stay empty.

## After submit
Leads appear in CoreKnot CRM with source **${form.defaults?.source || 'Website Form'}**.

## Test (server/curl)
\`\`\`bash
curl -X POST "${base}/api/public/forms/${form.publishableKey}/submit" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Test User","email":"test@example.com","message":"Hello"}'
\`\`\`
`;
}

module.exports = {
  listForms,
  getFormById,
  getFormByPublishableKey,
  createForm,
  updateForm,
  rotateFormKey,
  deleteForm,
  originAllowed,
  buildAgentPrompt,
  serializeForm,
};
