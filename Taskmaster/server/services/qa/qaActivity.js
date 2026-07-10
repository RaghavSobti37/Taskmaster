const SENSITIVE_KEYS = /password|secret|token|authorization|apikey|api_key/i;

function sanitizePayload(data) {
  if (data == null) return null;
  try {
    const clone = typeof data === 'object' ? { ...data } : data;
    if (typeof clone !== 'object') return String(clone).slice(0, 500);
    const out = {};
    for (const [k, v] of Object.entries(clone)) {
      if (SENSITIVE_KEYS.test(k)) {
        out[k] = '[redacted]';
      } else if (typeof v === 'object' && v !== null) {
        out[k] = sanitizePayload(v);
      } else {
        out[k] = v;
      }
    }
    return JSON.stringify(out).slice(0, 1200);
  } catch {
    return String(data).slice(0, 500);
  }
}

let activityHook = null;

function setQaActivityHook(fn) {
  activityHook = typeof fn === 'function' ? fn : null;
}

function reportQaActivity(patch) {
  if (activityHook) activityHook(patch);
}

function inferQaMeta(testCase) {
  const name = testCase.name || '';
  const id = testCase.checklistId || '';

  if (testCase.qaMeta) return { ...testCase.qaMeta };

  if (name.startsWith('[Pre-Deploy]')) {
    const live = id.startsWith('sec-live-');
    return {
      kind: live ? 'http' : 'static',
      action: live ? 'Live HTTP security probe' : 'Static config / source analysis',
      target: testCase.evidence || id,
      checklistId: id,
    };
  }
  if (name.startsWith('[Sanitization]') || name.startsWith('[Edge]')) {
    return {
      kind: 'http',
      action: 'HTTP probe (Suite 4/7)',
      checklistId: id,
      target: QA_API_BASE_HINT(),
    };
  }
  if (name.startsWith('[Lighthouse]') || testCase.category === 'lighthouse') {
    return {
      kind: 'lighthouse',
      action: 'Lighthouse performance & accessibility audit',
      target: testCase.qaMeta?.target || name,
      checklistId: testCase.checklistId,
    };
  }
  if (name.startsWith('[Integration]')) {
    return {
      kind: 'integration',
      action: 'Live API + DB integration test',
      checklistId: id,
    };
  }
  if (name.startsWith('[Security Live]')) {
    return {
      kind: 'http',
      action: 'Live webhook/API security probe',
      checklistId: id,
    };
  }
  if (name.includes('Dynamic QA Scan')) {
    const routeName = name.replace(/\[|\].*/g, '').trim();
    return {
      kind: 'page-scan',
      action: 'Dynamic pentest from page file heuristics',
      target: routeName,
      ...inferPageScanEndpoint(routeName),
    };
  }
  return { kind: 'unknown', action: 'Running test', checklistId: id };
}

function QA_API_BASE_HINT() {
  return process.env.QA_API_BASE_URL || process.env.API_URL || 'http://127.0.0.1:5000';
}

function inferPageScanEndpoint(routeName) {
  const lower = routeName.toLowerCase();
  if (lower.includes('forgotpassword') || lower.includes('resetpassword')) {
    return { method: 'POST', url: '/api/auth/forgot-password', payloadHint: '{ email }' };
  }
  if (lower.includes('userdata') || lower.includes('metaoauth')) {
    return { method: 'GET', url: '/api/webhooks/meta-data-deletion/:code', payloadHint: 'status lookup' };
  }
  if (lower.includes('googlesuccess') || lower.includes('oauth')) {
    return { method: 'POST', url: '/api/auth/oauth-establish', payloadHint: '{ ticket }' };
  }
  if (lower.includes('projectanalytics') || lower.includes('adminprojectanalytics')) {
    return { method: 'GET', url: '/api/projects', payloadHint: 'list (read-only probe)' };
  }
  if (lower.includes('crm') || lower.includes('lead') || lower.includes('exly')) {
    return { method: 'PUT', url: '/api/crm/leads/:id', payloadHint: '{ status: "won" }' };
  }
  if (lower.includes('finance') || lower.includes('invoice')) {
    return {
      method: 'PATCH',
      url: '/api/finance/:id/approve',
      payloadHint: '{ tenantId: "spoofed_tenant_999", ... }',
    };
  }
  if (lower.includes('project') || lower.includes('workspace')) {
    return { method: 'PUT', url: '/api/projects/:id', payloadHint: '{ visibility: "public", ... }' };
  }
  return { method: 'POST', url: '/api/general/ping', payloadHint: '{ data: "test" }' };
}

function formatActivitySummary(meta) {
  if (!meta) return '';
  if (meta.kind === 'static') {
    return `Static check → ${meta.target || meta.checklistId || 'repo files'}`;
  }
  if (meta.method && meta.url) {
    const body = meta.requestBody || meta.payloadHint;
    return `${meta.method} ${meta.url}${body ? ` · body ${body}` : ''}`;
  }
  return meta.action || meta.kind || '';
}

module.exports = {
  setQaActivityHook,
  reportQaActivity,
  sanitizePayload,
  inferQaMeta,
  inferPageScanEndpoint,
  formatActivitySummary,
};
