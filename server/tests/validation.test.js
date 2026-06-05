const { z } = require('zod');
const { validateBody } = require('../validation/validateBody');
const { registerBody, loginBody } = require('../validation/schemas/auth');
const { createLeadBody, leadNoteBody } = require('../validation/schemas/crm');
const { mailProfileBody, createCampaignBody, mailTemplateDraftBody } = require('../validation/schemas/mail');
const { submitInvoiceBody, createFolderBody } = require('../validation/schemas/finance');
const { scheduleQuery } = require('../validation/schemas/schedule');
const { calendarQuery, calendarEventBody } = require('../validation/schemas/calendar');
const { createNoteBody } = require('../validation/schemas/notes');
const {
  attendanceQuery,
  attendanceCheckBody,
  leaveRequestBody,
  leaveRequestsQuery,
} = require('../validation/schemas/attendance');
const { pushSubscribeBody } = require('../validation/schemas/notifications');
const {
  resendCampaignBody,
  resendFilteredCampaignBody,
} = require('../validation/schemas/campaigns');
const {
  projectBody,
  createWorkspaceBody,
  addMemberBody,
  linkCalendarBody,
} = require('../validation/schemas/projects');
const {
  dataHubPeopleQuery,
  dataHubReconcileQuery,
} = require('../validation/schemas/dataHub');
const { gamificationConfigBody } = require('../validation/schemas/gamification');
const {
  createArtistBody,
  updateArtistBody,
  injectEventBody,
  trackedVideoBody,
} = require('../validation/schemas/artist');
const { runAdminScriptBody } = require('../validation/schemas/admin');
const { validateQuery } = require('../validation/validateQuery');

describe('validateBody middleware', () => {
  const run = (schema, body) => new Promise((resolve) => {
    const req = { body };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateBody(schema)(req, res, () => resolve({ status: 200, req }));
  });

  it('accepts valid register payload', async () => {
    const out = await run(registerBody, {
      name: 'Test',
      email: 'a@b.com',
      password: 'Secret123!',
    });
    expect(out.status).toBe(200);
    expect(out.req.body.email).toBe('a@b.com');
  });

  it('rejects object injection with legacy error', async () => {
    const out = await run(loginBody, {
      email: { $ne: 'x' },
      password: { $gt: '' },
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('register schema rejects non-strings', () => {
    expect(registerBody.safeParse({ name: 1, email: 'a', password: 'p' }).success).toBe(false);
  });

  it('rejects CRM object injection', async () => {
    const out = await run(createLeadBody, { name: { $ne: '' }, phone: '+918591499393' });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts CRM lead note payload', async () => {
    const out = await run(leadNoteBody, { text: 'Follow up tomorrow' });
    expect(out.status).toBe(200);
    expect(out.req.body.text).toBe('Follow up tomorrow');
  });

  it('rejects mail profile object injection', async () => {
    const out = await run(mailProfileBody, { name: { $ne: '' }, email: 'a@b.com' });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts mail campaign create payload', async () => {
    const out = await run(createCampaignBody, { title: 'Test', leadIds: ['507f1f77bcf86cd799439011'] });
    expect(out.status).toBe(200);
    expect(out.req.body.title).toBe('Test');
  });

  it('rejects finance invoice object injection', async () => {
    const out = await run(submitInvoiceBody, { title: { $gt: '' }, fileUrl: 'https://x.com/f.pdf' });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts finance create folder payload', async () => {
    const out = await run(createFolderBody, { folderName: 'Q2', project: '507f1f77bcf86cd799439011' });
    expect(out.status).toBe(200);
    expect(out.req.body.folderName).toBe('Q2');
  });

  it('rejects mail template object injection', async () => {
    const out = await run(mailTemplateDraftBody, { name: { $ne: '' }, content: '<p>Hi</p>' });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts mail template draft payload', async () => {
    const out = await run(mailTemplateDraftBody, { name: 'Welcome', content: '<p>Hi</p>', subject: 'Hello' });
    expect(out.status).toBe(200);
    expect(out.req.body.name).toBe('Welcome');
  });
});

describe('validateQuery middleware', () => {
  const runQuery = (schema, query) => new Promise((resolve) => {
    const req = { query };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateQuery(schema)(req, res, () => resolve({ status: 200, req }));
  });

  it('accepts schedule date range query', async () => {
    const out = await runQuery(scheduleQuery, { start: '2026-06-06', end: '2026-06-10' });
    expect(out.status).toBe(200);
    expect(out.req.query.start).toBe('2026-06-06');
  });

  it('rejects invalid schedule start date', async () => {
    const out = await runQuery(scheduleQuery, { start: { $gt: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts calendar range query', async () => {
    const out = await runQuery(calendarQuery, { start: '2026-06-01', end: '2026-06-30' });
    expect(out.status).toBe(200);
    expect(out.req.query.end).toBe('2026-06-30');
  });

  it('rejects calendar query object injection', async () => {
    const out = await runQuery(calendarQuery, { start: { $ne: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });
});

describe('calendar and notes schemas', () => {
  const run = (schema, body) => new Promise((resolve) => {
    const req = { body };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateBody(schema)(req, res, () => resolve({ status: 200, req }));
  });

  it('accepts calendar event create payload', async () => {
    const out = await run(calendarEventBody, {
      title: 'Standup',
      startDate: '2026-06-10',
      startTime: '09:00',
      visibility: 'public',
    });
    expect(out.status).toBe(200);
    expect(out.req.body.title).toBe('Standup');
  });

  it('rejects calendar event object injection', async () => {
    const out = await run(calendarEventBody, { title: { $ne: '' }, date: '2026-06-10' });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts note create payload', async () => {
    const out = await run(createNoteBody, { title: 'Ideas', content: '<p>Hi</p>', visibility: 'private' });
    expect(out.status).toBe(200);
    expect(out.req.body.title).toBe('Ideas');
  });

  it('rejects note object injection', async () => {
    const out = await run(createNoteBody, { title: { $gt: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });
});

describe('attendance and notifications schemas', () => {
  const runBody = (schema, body) => new Promise((resolve) => {
    const req = { body };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateBody(schema)(req, res, () => resolve({ status: 200, req }));
  });

  const runQuery = (schema, query) => new Promise((resolve) => {
    const req = { query };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateQuery(schema)(req, res, () => resolve({ status: 200, req }));
  });

  it('accepts attendance week query', async () => {
    const out = await runQuery(attendanceQuery, { week: 'current', mine: 'true' });
    expect(out.status).toBe(200);
    expect(out.req.query.week).toBe('current');
  });

  it('rejects attendance query object injection', async () => {
    const out = await runQuery(attendanceQuery, { start: { $gt: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts attendance check body', async () => {
    const out = await runBody(attendanceCheckBody, { type: 'in', workMode: 'office' });
    expect(out.status).toBe(200);
    expect(out.req.body.type).toBe('in');
  });

  it('accepts leave request body', async () => {
    const out = await runBody(leaveRequestBody, { fromDate: '2026-06-10', toDate: '2026-06-12' });
    expect(out.status).toBe(200);
    expect(out.req.body.fromDate).toBe('2026-06-10');
  });

  it('accepts leave requests status filter', async () => {
    const out = await runQuery(leaveRequestsQuery, { status: 'pending' });
    expect(out.status).toBe(200);
    expect(out.req.query.status).toBe('pending');
  });

  it('accepts push subscribe payload', async () => {
    const out = await runBody(pushSubscribeBody, {
      subscription: {
        endpoint: 'https://push.example.com/sub/abc',
        keys: { p256dh: 'key', auth: 'auth' },
      },
    });
    expect(out.status).toBe(200);
    expect(out.req.body.subscription.endpoint).toContain('push.example.com');
  });

  it('rejects push subscribe object injection', async () => {
    const out = await runBody(pushSubscribeBody, {
      subscription: { endpoint: { $ne: '' }, keys: { p256dh: 'k', auth: 'a' } },
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });
});

describe('campaigns, projects, and data-hub schemas', () => {
  const runBody = (schema, body) => new Promise((resolve) => {
    const req = { body };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateBody(schema)(req, res, () => resolve({ status: 200, req }));
  });

  const runQuery = (schema, query) => new Promise((resolve) => {
    const req = { query };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload, req });
      },
    };
    validateQuery(schema)(req, res, () => resolve({ status: 200, req }));
  });

  it('accepts campaign resend payload', async () => {
    const out = await runBody(resendCampaignBody, {
      senderMode: 'single',
      senderProfileId: '507f1f77bcf86cd799439011',
      targetStatuses: ['Failed', 'Pending'],
    });
    expect(out.status).toBe(200);
    expect(out.req.body.senderMode).toBe('single');
  });

  it('rejects campaign resend object injection', async () => {
    const out = await runBody(resendCampaignBody, { senderProfileId: { $ne: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts campaign resend-filtered payload', async () => {
    const out = await runBody(resendFilteredCampaignBody, {
      recipientEmails: ['a@example.com'],
      statusFilter: 'opened',
      hideInvalid: true,
    });
    expect(out.status).toBe(200);
    expect(out.req.body.recipientEmails).toHaveLength(1);
  });

  it('accepts project create payload', async () => {
    const out = await runBody(projectBody, {
      name: 'Launch',
      workspace: 'GENERAL',
      members: [{ userId: '507f1f77bcf86cd799439011', role: 'member' }],
    });
    expect(out.status).toBe(200);
    expect(out.req.body.name).toBe('Launch');
  });

  it('rejects project object injection', async () => {
    const out = await runBody(projectBody, { name: { $gt: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts workspace create payload', async () => {
    const out = await runBody(createWorkspaceBody, { name: 'Ops', color: '#126d5e' });
    expect(out.status).toBe(200);
    expect(out.req.body.name).toBe('Ops');
  });

  it('accepts add member payload', async () => {
    const out = await runBody(addMemberBody, { userId: '507f1f77bcf86cd799439011', role: 'member' });
    expect(out.status).toBe(200);
    expect(out.req.body.userId).toBeTruthy();
  });

  it('accepts link calendar payload', async () => {
    const out = await runBody(linkCalendarBody, { calendarId: 'primary' });
    expect(out.status).toBe(200);
    expect(out.req.body.calendarId).toBe('primary');
  });

  it('accepts data-hub people query', async () => {
    const out = await runQuery(dataHubPeopleQuery, { page: '1', limit: '25', folder: 'crm' });
    expect(out.status).toBe(200);
    expect(out.req.query.folder).toBe('crm');
  });

  it('rejects data-hub people query object injection', async () => {
    const out = await runQuery(dataHubPeopleQuery, { page: { $gt: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts data-hub reconcile query', async () => {
    const out = await runQuery(dataHubReconcileQuery, { full: 'true' });
    expect(out.status).toBe(200);
    expect(out.req.query.full).toBe('true');
  });

  it('accepts gamification config payload', async () => {
    const out = await runBody(gamificationConfigBody, { taskCompletion: 10, reviewApproval: 5 });
    expect(out.status).toBe(200);
    expect(out.req.body.taskCompletion).toBe(10);
  });

  it('rejects gamification config object injection', async () => {
    const out = await runBody(gamificationConfigBody, { taskCompletion: { $gt: 0 } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts artist create payload', async () => {
    const out = await runBody(createArtistBody, {
      name: 'Artist One',
      bio: 'Bio',
      oauthCredentials: { spotify: { artistId: 'abc123' } },
    });
    expect(out.status).toBe(200);
    expect(out.req.body.name).toBe('Artist One');
  });

  it('rejects artist object injection', async () => {
    const out = await runBody(updateArtistBody, { name: { $ne: '' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });

  it('accepts artist inject-event payload', async () => {
    const out = await runBody(injectEventBody, { type: 'gig', title: 'Show' });
    expect(out.status).toBe(200);
    expect(out.req.body.type).toBe('gig');
  });

  it('accepts tracked video payload', async () => {
    const out = await runBody(trackedVideoBody, { url: 'https://youtu.be/abc', title: 'Video' });
    expect(out.status).toBe(200);
    expect(out.req.body.url).toContain('youtu.be');
  });

  it('accepts empty admin script run body', async () => {
    const out = await runBody(runAdminScriptBody, {});
    expect(out.status).toBe(200);
  });

  it('rejects admin script run object injection', async () => {
    const out = await runBody(runAdminScriptBody, { options: { filter: { $ne: null } } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Invalid input format');
  });
});
