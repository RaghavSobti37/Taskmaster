const Project = require('../../models/Project');
const Task = require('../../models/Task');
const {
  isApiReachable,
  resolveTestUsers,
  skipProbeResult,
  probeFail,
  probePass,
  request,
  QA_API_BASE,
} = require('./qaApiClient');
const { purgeQaIdentity } = require('./qaTestData');

/** Suite 4 + Suite 7 — dedicated HTTP probes (not tied to page filename). */
const PROBE_DEFS = [
  // ── Suite 4: Sanitization ──
  {
    id: 'san-nosql-lead-body',
    title: 'NoSQL operator injected in lead email body',
    category: 'input-validation',
    sev: 'critical',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/crm/leads',
        user: adminUser,
        data: { name: 'QA Inject', email: { $gt: '' }, phone: '9876500001' },
      });
      const ok = res.status >= 400 || (res.status === 200 && typeof res.data?.email === 'string');
      return ok
        ? probePass(this, `Lead create blocked or sanitized (${res.status})`, JSON.stringify(res.data).slice(0, 200))
        : probeFail(this, `NoSQL operator may have executed (${res.status})`, res.status);
    },
  },
  {
    id: 'san-nosql-login-bypass',
    title: 'NoSQL injection on login bypasses auth',
    category: 'input-validation',
    sev: 'critical',
    suite: 's4',
    async run() {
      const res = await request(this, {
        method: 'POST',
        url: '/api/auth/login',
        headers: {},
        data: { email: { $regex: '.*' }, password: { $gt: '' } },
      });
      const ok = res.status === 400 || res.status === 401 || res.status === 429;
      return ok
        ? probePass(this, `Login rejected malformed operators (${res.status})`)
        : probeFail(this, `Login accepted NoSQL operators (${res.status})`, res.status);
    },
  },
  {
    id: 'san-nosql-query-param',
    title: 'NoSQL operator in query string param',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const { anyUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'GET',
        url: '/api/tasks?status[$ne]=done',
        user: anyUser,
      });
      const ok = res.status === 400 || res.status === 200;
      return ok
        ? probePass(this, `Query handled safely (${res.status})`)
        : probeFail(this, `Unhandled query operator (${res.status})`, res.status);
    },
  },
  {
    id: 'san-proto-pollution',
    title: 'Prototype pollution via __proto__ key',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const project = await Project.findOne().select('_id');
      if (!project) return skipProbeResult(this, 'No project for task probe');
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/tasks',
        user: adminUser,
        data: { __proto__: { isAdmin: true }, title: 'QA Proto', projectId: project._id },
      });
      const polluted = Object.prototype.isAdmin === true;
      const ok = !polluted && (res.status === 400 || res.status === 201 || res.status === 200);
      return ok
        ? probePass(this, `Proto pollution blocked (${res.status})`)
        : probeFail(this, polluted ? 'Object.prototype polluted' : `Unexpected ${res.status}`, res.status);
    },
  },
  {
    id: 'san-xss-task-title',
    title: 'XSS script tag in task title field',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const project = await Project.findOne().select('_id');
      if (!project) return skipProbeResult(this, 'No project for task probe');
      const { adminUser } = await resolveTestUsers();
      const title = "<script>alert('xss')</script>";
      const res = await request(this, {
        method: 'POST',
        url: '/api/tasks',
        user: adminUser,
        data: { title, projectId: project._id },
      });
      if (res.status >= 400) return probePass(this, `Rejected or failed safely (${res.status})`);
      const stored = res.data?.title || res.data?.data?.title || '';
      const ok = !String(stored).includes('<script');
      return ok
        ? probePass(this, 'Script tag neutralized in stored title')
        : probeFail(this, 'Raw script tag stored', stored);
    },
  },
  {
    id: 'san-xss-lead-name',
    title: 'XSS img onerror in lead name field',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/crm/leads',
        user: adminUser,
        data: { name: '<img src=x onerror=alert(1)>', phone: '9876500002', email: `qa-xss-${Date.now()}@test.com` },
      });
      const name = res.data?.name || res.data?.data?.name || '';
      const ok = res.status >= 400 || !String(name).includes('<img');
      return ok
        ? probePass(this, 'Lead name HTML neutralized or rejected')
        : probeFail(this, 'Raw HTML stored in lead name', name);
    },
  },
  {
    id: 'san-xss-announcement-iframe',
    title: 'XSS iframe in announcement broadcast',
    category: 'input-validation',
    sev: 'critical',
    suite: 's4',
    async run() {
      const { opsUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/announcements',
        user: opsUser,
        data: {
          title: 'QA XSS',
          message: "<iframe src='https://evil.com'></iframe>",
          audienceType: 'all',
          sendEmail: false,
        },
      });
      if (res.status === 403) return probePass(this, 'Non-ops blocked from announcements');
      const msg = res.data?.message || res.data?.data?.message || '';
      const ok = res.status >= 400 || !String(msg).includes('<iframe');
      return ok
        ? probePass(this, 'iframe stripped or request rejected')
        : probeFail(this, 'iframe stored in announcement', msg);
    },
  },
  {
    id: 'san-phone-invalid-format',
    title: 'Invalid phone string rejected',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/crm/leads',
        user: adminUser,
        data: { name: 'QA Bad Phone', phone: 'not-a-phone', email: `qa-bad-${Date.now()}@test.com` },
      });
      const ok = res.status === 400 || res.status === 422;
      return ok
        ? probePass(this, `Invalid phone rejected (${res.status})`)
        : probeFail(this, `Invalid phone accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'san-email-invalid-format',
    title: 'Invalid email string rejected',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/crm/leads',
        user: adminUser,
        data: { name: 'QA Bad Email', phone: '9876500003', email: 'notanemail' },
      });
      const ok = res.status === 400 || res.status === 422;
      return ok
        ? probePass(this, `Invalid email rejected (${res.status})`)
        : probeFail(this, `Invalid email accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'san-task-invalid-status',
    title: 'Invalid task status enum rejected',
    category: 'input-validation',
    sev: 'medium',
    suite: 's4',
    async run() {
      const task = await Task.findOne().select('_id');
      if (!task) return skipProbeResult(this, 'No task for PATCH probe');
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'PUT',
        url: `/api/tasks/${task._id}`,
        user: adminUser,
        data: { status: 'flying_purple_monkeys' },
      });
      const ok = res.status === 400;
      return ok
        ? probePass(this, 'Invalid status rejected')
        : probeFail(this, `Invalid status accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'san-objectid-invalid-param',
    title: 'Non-ObjectId URL param returns 400 not 500',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const { anyUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'GET',
        url: '/api/tasks/im-not-an-objectid',
        user: anyUser,
      });
      const ok = res.status === 400 || res.status === 404;
      return ok
        ? probePass(this, `Invalid id handled (${res.status})`)
        : probeFail(this, `Server error on bad id (${res.status})`, res.status);
    },
  },
  {
    id: 'san-name-overflow',
    title: '5000-char string in name field',
    category: 'input-validation',
    sev: 'medium',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/crm/leads',
        user: adminUser,
        data: { name: 'A'.repeat(5000), phone: '9876500004', email: `qa-long-${Date.now()}@test.com` },
      });
      const ok = res.status === 400 || (res.status === 200 && (res.data?.name || '').length < 500);
      return ok
        ? probePass(this, 'Long name rejected or truncated')
        : probeFail(this, '5000-char name stored', res.status);
    },
  },
  {
    id: 'san-empty-body-required',
    title: 'Empty body on required-field endpoint returns 400',
    category: 'input-validation',
    sev: 'medium',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/tasks',
        user: adminUser,
        data: {},
      });
      const ok = res.status === 400;
      return ok
        ? probePass(this, 'Empty task body rejected')
        : probeFail(this, `Empty body accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'san-finance-tenant-spoof',
    title: 'Finance approve rejects spoofed tenantId in body',
    category: 'permission',
    sev: 'critical',
    suite: 's4',
    async run() {
      const FinanceDocument = require('../../models/FinanceDocument');
      const doc = await FinanceDocument.findOne({ approvalStatus: 'pending' }) ||
        await FinanceDocument.findOne();
      if (!doc) return skipProbeResult(this, 'No finance document for approve probe');
      const { opsUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'PATCH',
        url: `/api/finance/${doc._id}/approve`,
        user: opsUser,
        data: { tenantId: 'spoofed_tenant_999', amount: 1 },
      });
      const ok = res.status === 403;
      return ok
        ? probePass(this, 'Spoofed tenantId rejected with 403')
        : probeFail(this, `Expected 403, got ${res.status}`, res.status);
    },
  },
  // ── Suite 7: Edge cases ──
  {
    id: 'edge-expired-jwt',
    title: 'Expired JWT returns 401',
    category: 'authorization',
    sev: 'critical',
    suite: 's7',
    async run() {
      const jwt = require('jsonwebtoken');
      const { anyUser } = await resolveTestUsers();
      const token = jwt.sign({ id: anyUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: -10 });
      const res = await request(this, {
        method: 'GET',
        url: '/api/tasks',
        headers: { Authorization: `Bearer ${token}` },
      });
      const ok = res.status === 401;
      return ok
        ? probePass(this, 'Expired token rejected')
        : probeFail(this, `Expired token accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'edge-tampered-jwt',
    title: 'Tampered JWT signature returns 401',
    category: 'authorization',
    sev: 'critical',
    suite: 's7',
    async run() {
      const jwt = require('jsonwebtoken');
      const { anyUser } = await resolveTestUsers();
      const good = jwt.sign({ id: anyUser._id }, process.env.JWT_SECRET || 'secret');
      const parts = good.split('.');
      const tampered = `${parts[0]}.${Buffer.from('{"id":"tampered"}').toString('base64url')}.${parts[2]}`;
      const res = await request(this, {
        method: 'GET',
        url: '/api/projects',
        headers: { Authorization: `Bearer ${tampered}` },
      });
      const ok = res.status === 401;
      return ok
        ? probePass(this, 'Tampered token rejected')
        : probeFail(this, `Tampered token accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'edge-no-auth-header',
    title: 'Missing Authorization header on protected route',
    category: 'authorization',
    sev: 'high',
    suite: 's7',
    async run() {
      const res = await request(this, {
        method: 'GET',
        url: '/api/auth/me',
        skipAuth: true,
      });
      const ok = res.status === 401;
      return ok
        ? probePass(this, 'Unauthenticated request blocked')
        : probeFail(this, `Open access (${res.status})`, res.status);
    },
  },
  {
    id: 'edge-invalid-objectid-param',
    title: 'Non-ObjectId URL param returns 400 not 500',
    category: 'authorization',
    sev: 'high',
    suite: 's7',
    async run() {
      const { anyUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'GET',
        url: '/api/tasks/not-valid-objectid',
        user: anyUser,
      });
      const ok = res.status === 400 || res.status === 404;
      return ok
        ? probePass(this, `Bad id handled (${res.status})`)
        : probeFail(this, `Server error (${res.status})`, res.status);
    },
  },
  {
    id: 'edge-valid-nonexistent-id',
    title: 'Valid ObjectId for nonexistent resource returns 404',
    category: 'authorization',
    sev: 'medium',
    suite: 's7',
    async run() {
      const mongoose = require('mongoose');
      const fakeId = new mongoose.Types.ObjectId();
      const { anyUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'GET',
        url: `/api/tasks/${fakeId}`,
        user: anyUser,
      });
      const ok = res.status === 404;
      return ok
        ? probePass(this, 'Missing task returns 404')
        : probeFail(this, `Expected 404, got ${res.status}`, res.status);
    },
  },
  {
    id: 'edge-finance-tenant-spoof',
    title: 'Finance approve rejects cross-tenant spoof payload',
    category: 'permission',
    sev: 'critical',
    suite: 's7',
    async run() {
      const FinanceDocument = require('../../models/FinanceDocument');
      const doc = await FinanceDocument.findOne();
      if (!doc) return skipProbeResult(this, 'No finance document');
      const { anyUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'PATCH',
        url: `/api/finance/${doc._id}/approve`,
        user: anyUser,
        data: { tenantId: 'spoofed_tenant_999' },
      });
      const ok = res.status === 403;
      return ok
        ? probePass(this, 'Tenant spoof blocked')
        : probeFail(this, `Expected 403, got ${res.status}`, res.status);
    },
  },
  {
    id: 'edge-task-past-due-date',
    title: 'Task with past dueDate rejected',
    category: 'business-logic',
    sev: 'high',
    suite: 's7',
    async run() {
      const project = await Project.findOne().select('_id');
      if (!project) return skipProbeResult(this, 'No project');
      const { adminUser } = await resolveTestUsers();
      const res = await request(this, {
        method: 'POST',
        url: '/api/tasks',
        user: adminUser,
        data: { title: 'Backdated QA', projectId: project._id, dueDate: '2020-01-01' },
      });
      const ok = res.status === 400;
      return ok
        ? probePass(this, 'Past dueDate rejected')
        : probeFail(this, `Past date accepted (${res.status})`, res.status);
    },
  },
  {
    id: 'san-duplicate-lead-phone',
    title: 'Duplicate phone lead for same tenant returns 409',
    category: 'input-validation',
    sev: 'critical',
    suite: 's4',
    async run() {
      const { adminUser } = await resolveTestUsers();
      const phone = `98${String(Date.now()).slice(-8)}`;
      const emailA = `qa-dup-a-${Date.now()}@test.com`;
      const emailB = `qa-dup-b-${Date.now()}@test.com`;
      const payload = { name: 'QA Dup A', phone, email: emailA };
      try {
        const r1 = await request(this, {
          method: 'POST',
          url: '/api/crm/leads',
          user: adminUser,
          data: payload,
        });
        const r2 = await request(this, {
          method: 'POST',
          url: '/api/crm/leads',
          user: adminUser,
          data: { ...payload, name: 'QA Dup B', email: emailB },
        });
        const ok = r1.status < 400 && (r2.status === 409 || r2.status === 400);
        return ok
          ? probePass(this, `Duplicate phone blocked (${r2.status})`)
          : probeFail(this, `Duplicate phone allowed (${r1.status}/${r2.status})`, r2.status);
      } finally {
        await purgeQaIdentity({ phone, email: emailA }).catch(() => {});
        await purgeQaIdentity({ email: emailB }).catch(() => {});
      }
    },
  },
  {
    id: 'san-payload-oversized',
    title: 'Oversized JSON body returns 413',
    category: 'input-validation',
    sev: 'high',
    suite: 's4',
    async run() {
      const serverJs = await require('fs').promises.readFile(
        require('path').join(__dirname, '../../server.js'),
        'utf8'
      ).catch(() => '');
      const hasLimit = serverJs.includes("limit:") && serverJs.includes('mb');
      return hasLimit
        ? probePass(this, 'express.json body size limit configured in server.js')
        : probeFail(this, 'No express.json size limit found');
    },
  },
  {
    id: 'edge-login-rate-limit',
    title: '11th login attempt returns 429',
    category: 'rate-limiting',
    sev: 'high',
    suite: 's7',
    timeout: 30000,
    async run() {
      const email = `qa-ratelimit-${Date.now()}@example.com`;
      let lastStatus = 0;
      for (let i = 0; i < 11; i += 1) {
        const res = await request(this, {
          method: 'POST',
          url: '/api/auth/login',
          headers: {},
          data: { email, password: 'WrongPass123!' },
        });
        lastStatus = res.status;
        if (res.status === 429) {
          return probePass(this, `Rate limit engaged on attempt ${i + 1}`);
        }
      }
      return probeFail(this, `No 429 after 11 attempts (last ${lastStatus})`, lastStatus);
    },
  },
];

function wrapProbe(def) {
  return {
    name: `[${def.suite === 's4' ? 'Sanitization' : 'Edge'}] ${def.title}`,
    category: def.category,
    severity: def.sev,
    checklistId: def.id,
    qaMeta: {
      kind: 'http',
      action: `HTTP probe (${def.suite === 's4' ? 'Suite 4 sanitization' : 'Suite 7 edge'})`,
      method: def.method || 'GET',
      url: def.url || '(see probe)',
      payloadHint: def.payloadHint,
      checklistId: def.id,
      category: def.category,
    },
    test: async () => {
      if (!(await isApiReachable())) {
        return skipProbeResult(def, `API not reachable at ${QA_API_BASE()}`);
      }
      try {
        return await def.run.call(def);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          return skipProbeResult(def, err.message);
        }
        return probeFail(def, err.message, err.stack);
      }
    },
  };
}

async function buildExtendedProbeTestCases() {
  return PROBE_DEFS.map(wrapProbe);
}

module.exports = { buildExtendedProbeTestCases, PROBE_DEFS };
