/**
 * Live smoke test against running server (default :5000).
 * Usage: node scripts/smokeEmailFlowLive.js
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = `smoke-live-${Date.now()}@test.local`;

function request(method, path, body, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function extractCookie(setCookie) {
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.map((c) => c.split(';')[0]).join('; ');
}

async function main() {
  const steps = [];
  const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };
  const ok = (msg) => { steps.push(msg); console.log('OK:', msg); };

  const reg = await request('POST', '/api/auth/register', {
    name: 'Smoke Live',
    email: EMAIL,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
  });
  if (reg.status !== 201) fail(`register ${reg.status} ${reg.raw}`);

  const login = await request('POST', '/api/auth/login', { email: EMAIL, password: DEV_DEFAULT_PASSWORD });
  if (login.status !== 200) fail(`login ${login.status}`);
  let cookie = extractCookie(login.headers['set-cookie']);
  ok('auth');

  const preview = await request('POST', '/api/mail/preview', {
    content: '<p class="ql-indent-1">Hi {1}</p>',
    subject: 'Smoke',
    removeUnsubscribe: true,
    sampleRecipient: { email: 'a@b.com', rowData: { name: 'SmokeName' } },
    variableMapping: { 1: 'name' },
  }, cookie);
  if (preview.status !== 200) fail(`preview ${preview.status}`);
  if (!preview.body?.html?.includes('SmokeName')) fail('preview missing personalized name');
  if (/ql-indent/i.test(preview.body.html)) fail('preview still has ql-indent');
  if (!/padding-left\s*:\s*3em!important/i.test(preview.body.html)) fail('preview missing inlined indent padding');
  ok('preview API');

  const tpl = await request('POST', '/api/mail/templates', {
    name: `SMOKE_LIVE_${Date.now()}`,
    subject: 'Hi {1}',
    content: '<p>Hello {1}</p>',
    dummyValues: { 1: 'World' },
  }, cookie);
  if (tpl.status !== 200) fail(`template ${tpl.status}`);
  const templateId = tpl.body._id;

  await request('POST', `/api/mail/templates/${templateId}/submit`, null, cookie);
  let appr = await request('POST', `/api/mail/templates/${templateId}/approve`, null, cookie);
  if (appr.status === 403) {
    const User = require('../models/User');
    const Department = require('../models/Department');
    const MailTemplate = require('../models/MailTemplate');
    await mongoose.connect(process.env.MONGODB_URI);
    let adminDept = await Department.findOne({ slug: 'admin' });
    if (!adminDept) {
      adminDept = await Department.create({ name: 'Admin', slug: 'admin', permissionPreset: 'admin' });
    }
    await User.findOneAndUpdate({ email: EMAIL }, { departmentId: adminDept._id });
    await mongoose.disconnect();
    const login2 = await request('POST', '/api/auth/login', { email: EMAIL, password: DEV_DEFAULT_PASSWORD });
    const cookie2 = extractCookie(login2.headers['set-cookie']);
    appr = await request('POST', `/api/mail/templates/${templateId}/approve`, null, cookie2);
    if (appr.status !== 200) fail(`approve after admin promote ${appr.status}`);
    cookie = cookie2;
  } else if (appr.status !== 200) {
    fail(`approve ${appr.status}`);
  }
  ok('template approved');

  const draft = await request('POST', '/api/campaigns', {
    action: 'save_draft',
    title: 'SMOKE_LIVE_DRAFT',
    subject: 'Sub',
    content: appr.body.approvedContent || tpl.body.content,
    mailTemplateId: templateId,
    variableMapping: { 1: 'name' },
    senderMode: 'system_resend',
    includeSignature: false,
    removeUnsubscribe: true,
    customRecipients: [{ name: 'Test', email: 'test@example.com', rowData: { name: 'Live' } }],
  }, cookie);
  if (draft.status !== 201) fail(`draft ${draft.status} ${draft.raw}`);
  if (draft.body.status !== 'Draft') fail(`expected Draft got ${draft.body.status}`);
  ok('save_draft');

  const disp = await request('POST', `/api/campaigns/${draft.body._id}/dispatch`, null, cookie);
  if (disp.status !== 200 || !disp.body.success) fail(`dispatch ${disp.status} ${JSON.stringify(disp.body)}`);
  ok('dispatch from draft');

  console.log('\nAll live smoke steps passed:', steps.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
