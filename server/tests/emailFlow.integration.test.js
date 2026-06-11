/**
 * End-to-end email engine: unified HTML pipeline, draft/dispatch, preview API.
 * Run: npm test -- emailFlow.integration.test.js
 */
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const Campaign = require('../models/Campaign');
const MailTemplate = require('../models/MailTemplate');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { buildFinalEmailHtml, personalizeEmailContent } = require('../utils/buildFinalEmailHtml');

const TEST_EMAIL = `email-flow-${Date.now()}@coreknot-test.local`;
const QUILL_INDENT_HTML = '<p class="ql-indent-2" style="padding-left: 3em;">Hello {1}</p>';

describe('Email flow integration', () => {
  let agent;

  afterAll(async () => {
    const { drainMemoryQueue } = require('../services/queueService');
    await drainMemoryQueue();
  });

  beforeEach(async () => {
    let adminDept = await Department.findOne({ slug: 'admin' });
    if (!adminDept) {
      adminDept = await Department.create({
        name: 'Admin',
        slug: 'admin',
        permissionPreset: 'admin',
        pagePermissions: ['emails', 'admin'],
      });
    }

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Email Flow Tester', email: TEST_EMAIL, password: DEV_DEFAULT_PASSWORD, gender: 'male' });
    expect(reg.statusCode).toBe(201);
    await User.findByIdAndUpdate(reg.body._id, { departmentId: adminDept._id });

    agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: DEV_DEFAULT_PASSWORD });
    expect(login.statusCode).toBe(200);
  }, 30000);

  describe('buildFinalEmailHtml pipeline', () => {
    it('converts Quill indent classes to inline padding-left for email clients', async () => {
      const out = await buildFinalEmailHtml({
        html: QUILL_INDENT_HTML,
        mode: 'preview',
        removeUnsubscribe: true,
      });
      expect(out).toMatch(/padding-left\s*:\s*6em/i);
      expect(out).toContain('Hello {1}');
    });

    it('preserves stacked indent levels across multiple lines', async () => {
      const html = [
        '<p>Flush left</p>',
        '<p class="ql-indent-1">Indent one</p>',
        '<p class="ql-indent-2">Indent two</p>',
        '<p class="ql-indent-3">Indent three</p>',
      ].join('');
      const out = await buildFinalEmailHtml({ html, mode: 'preview', removeUnsubscribe: true });
      expect(out).toMatch(/padding-left\s*:\s*3em/i);
      expect(out).toMatch(/padding-left\s*:\s*6em/i);
      expect(out).toMatch(/padding-left\s*:\s*9em/i);
    });

    it('preview and test modes produce same indent normalization', async () => {
      const preview = await buildFinalEmailHtml({ html: QUILL_INDENT_HTML, mode: 'preview', removeUnsubscribe: true });
      const test = await buildFinalEmailHtml({ html: QUILL_INDENT_HTML, mode: 'test', removeUnsubscribe: true });
      expect(preview.replace(/\s+/g, ' ')).toBe(test.replace(/\s+/g, ' '));
    });

    it('preserves inline padding-left without ql-indent classes', async () => {
      const out = await buildFinalEmailHtml({
        html: '<p style="padding-left: 3em">Indented</p>',
        mode: 'preview',
        removeUnsubscribe: true,
      });
      expect(out).toMatch(/padding-left\s*:\s*3em/i);
    });

    it('preserves blank lines as email-safe spacers', async () => {
      const out = await buildFinalEmailHtml({
        html: '<p>line one</p><p><br></p><p>line two</p>',
        mode: 'preview',
        removeUnsubscribe: true,
      });
      expect(out).toContain('line one');
      expect(out).toContain('line two');
      expect(out).toMatch(/&nbsp;/i);
      expect(out).not.toMatch(/<p[^>]*><br\s*\/?><\/p>/i);
    });

    it('converts Quill spacer paragraphs to nbsp blocks in real templates', async () => {
      const fs = require('fs');
      const path = require('path');
      const html = fs.readFileSync(
        path.join(__dirname, '../templates/testing_with_harshika_template.html'),
        'utf8'
      );
      const out = await buildFinalEmailHtml({ html, mode: 'preview', removeUnsubscribe: true });
      expect((html.match(/<p><br\s*\/?><\/p>/gi) || []).length).toBeGreaterThan(0);
      expect(out).not.toMatch(/<p[^>]*><br\s*\/?><\/p>/i);
      expect(out).toMatch(/&nbsp;/i);
    });

    it('skips normalization for rawHtml fragments', async () => {
      const out = await buildFinalEmailHtml({
        html: '<p style="padding-left: 40px">Raw indent</p>',
        format: 'rawHtml',
        mode: 'preview',
        removeUnsubscribe: true,
      });
      expect(out).toMatch(/padding-left\s*:\s*40px/i);
    });

    it('does not zero indent when juicing styled visual HTML', async () => {
      const out = await buildFinalEmailHtml({
        html: '<style>.indented { padding-left: 48px; }</style><p class="indented">Hi</p>',
        format: 'visual',
        mode: 'preview',
        removeUnsubscribe: true,
      });
      expect(out).toMatch(/padding-left\s*:\s*3em/i);
      expect(out).not.toMatch(/padding-left\s*:\s*0!important/i);
    });

    it('personalizeEmailContent applies {n} variables', () => {
      const { html } = personalizeEmailContent({
        html: '<p>Hi {1}</p>',
        subject: 'Sub {1}',
        recipient: { email: 'a@b.com', rowData: { name: 'Raghav' } },
        variableMapping: { 1: 'name' },
      });
      expect(html).toContain('Raghav');
      expect(html).not.toContain('{1}');
    });
  });

  describe('HTTP mail + campaign API (full workflow)', () => {
    it('preview → template approval → draft → dispatch', async () => {
      const previewRes = await agent.post('/api/mail/preview').send({
        content: QUILL_INDENT_HTML,
        subject: 'Preview test',
        removeUnsubscribe: true,
        sampleRecipient: { email: 'preview@test.com', name: 'Test', rowData: { name: 'Test' } },
        variableMapping: { 1: 'name' },
      });
      expect(previewRes.statusCode).toBe(200);
      expect(previewRes.body.html).toMatch(/<!DOCTYPE html>/i);
      expect(previewRes.body.html).toContain('Test');
      expect(previewRes.body.html).toMatch(/padding-left\s*:\s*6em/i);

      const save = await agent.post('/api/mail/templates').send({
        name: `EMAIL_FLOW_TEST_${Date.now()}`,
        subject: 'Hello {1}',
        content: '<p>Hi {1}, welcome.</p>',
        format: 'visual',
        dummyValues: { 1: 'Friend' },
      });
      expect(save.statusCode).toBe(200);
      const templateId = save.body._id;

      const submit = await agent.post(`/api/mail/templates/${templateId}/submit`);
      expect(submit.statusCode).toBe(200);
      expect(submit.body.status).toBe('pending_approval');

      const approve = await agent.post(`/api/mail/templates/${templateId}/approve`);
      expect(approve.statusCode).toBe(200);
      expect(approve.body.status).toBe('approved');

      const tpl = await MailTemplate.findById(templateId);
      const draftRes = await agent.post('/api/campaigns').send({
        action: 'save_draft',
        title: 'EMAIL_FLOW_TEST_DRAFT',
        subject: 'Draft subject',
        content: tpl.approvedContent,
        mailTemplateId: templateId,
        variableMapping: { 1: 'name' },
        senderMode: 'system_resend',
        resendFromEmail: 'team@theshakticollective.in',
        includeSignature: false,
        removeUnsubscribe: true,
        customRecipients: [
          { name: 'Redacted User', email: 'redacted@example.com', rowData: { name: 'Raghav' } },
        ],
      });
      expect(draftRes.statusCode).toBe(201);
      expect(draftRes.body.status).toBe('Draft');
      expect(draftRes.body.dispatch).toBeFalsy();

      const draftId = draftRes.body._id;
      const freshDraft = await Campaign.findById(draftId);
      expect(freshDraft.status).toBe('Draft');

      const dispatchRes = await agent.post(`/api/campaigns/${draftId}/dispatch`);
      expect(dispatchRes.statusCode).toBe(200);
      expect(dispatchRes.body.success).toBe(true);

      const afterDispatch = await Campaign.findById(draftId);
      expect(['Sending', 'Queued', 'Completed']).toContain(afterDispatch.status);

      const instantRes = await agent.post('/api/campaigns').send({
        action: 'dispatch',
        title: `EMAIL_FLOW_TEST_DISPATCH_${Date.now()}`,
        subject: 'Dispatch subject',
        content: tpl.approvedContent,
        mailTemplateId: templateId,
        variableMapping: { 1: 'name' },
        senderMode: 'system_resend',
        resendFromEmail: 'team@theshakticollective.in',
        includeSignature: false,
        removeUnsubscribe: true,
        customRecipients: [
          { name: 'Test', email: `dispatch-${Date.now()}@test.local`, rowData: { name: 'DispatchName' } },
        ],
      });
      expect(instantRes.statusCode).toBe(201);
      expect(instantRes.body.status).toBe('Queued');
      expect(instantRes.body.dispatch?.success).toBe(true);
    });
  });
});
