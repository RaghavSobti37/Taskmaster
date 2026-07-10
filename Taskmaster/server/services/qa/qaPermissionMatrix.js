/**
 * Layer 3 — Permission Matrix Engine
 * Auto-verify allow/deny per role against action registry.
 */
const FinanceDocument = require('../../models/FinanceDocument');
const {
  getAllActions,
  getRoleDefs,
  roleShouldAllow,
} = require('./qaActionRegistry');
const {
  isApiReachable,
  resolveTestUsers,
  skipProbeResult,
  probeFail,
  probePass,
  request,
} = require('./qaApiClient');
const { purgeQaIdentity, qaUniqueEmail, qaUniquePhone, qaLeadPayload } = require('./qaTestData');
const Project = require('../../models/Project');

async function resolveRoleUser(roleKey, users) {
  const map = {
    admin: users.adminUser,
    operations: users.opsUser,
    sales: users.salesUser,
    artist_management: users.artistUser,
    user: users.standardUser,
    manager: users.managerUser,
    platform_owner: users.platformOwnerUser,
  };
  return map[roleKey] || users.anyUser;
}

async function resolveDynamicUrl(action, ctx) {
  let url = action.url;
  if (!url.includes(':id')) return url;

  if (action.dynamicId === 'finance') {
    if (!ctx.financeDocId) {
      const users = await resolveTestUsers();
      const doc = await FinanceDocument.create({
        title: `QA Perm ${Date.now()}`,
        fileUrl: 'https://example.com/qa.pdf',
        category: 'invoice',
        approvalStatus: 'pending',
        uploadedBy: users.opsUser?._id || users.adminUser._id,
        submittedBy: users.opsUser?._id || users.adminUser._id,
      });
      ctx.financeDocId = doc._id;
      ctx.artifacts.push({ type: 'finance', id: doc._id });
    }
    return url.replace(':id', ctx.financeDocId);
  }
  return url.replace(':id', '000000000000000000000000');
}

function matrixCase(action, roleKey) {
  const roleDef = getRoleDefs()[roleKey];
  const expectAllow = roleShouldAllow(action, roleKey);
  return {
    name: `[Permission] ${action.label} — ${roleDef?.label || roleKey}`,
    category: 'permission',
    severity: action.sev || 'high',
    checklistId: `perm-${action.id}-${roleKey}`,
    qaMeta: {
      kind: 'permission-matrix',
      action: action.label,
      method: action.method,
      url: action.url,
      role: roleKey,
      expectAllow,
      layer: 3,
    },
    test: async () => {
      if (!(await isApiReachable())) {
        return skipProbeResult({ id: action.id, title: action.label, category: action.category }, `API not reachable`);
      }
      const users = await resolveTestUsers();
      const user = await resolveRoleUser(roleKey, users);
      if (!user) {
        return skipProbeResult({ id: action.id, title: action.label }, `No probe user for role ${roleKey}`);
      }

      const ctx = { artifacts: [] };
      const url = await resolveDynamicUrl(action, ctx);
      let data;
      if (action.method === 'POST' && action.url.includes('/crm/leads')) {
        const payload = qaLeadPayload();
        await purgeQaIdentity({ email: payload.email, phone: payload.phone });
        data = payload;
      } else if (action.method === 'POST' && action.url.includes('/tasks')) {
        data = { title: `QA Perm ${Date.now()}`, projectId: (await Project.findOne().select('_id'))?._id };
      } else if (action.method === 'POST') {
        data = {};
      }

      const res = await request(
        { id: action.id, title: action.label, category: action.category, sev: action.sev },
        { method: action.method, url, data, user }
      );

      const allowed = res.status >= 200 && res.status < 300;
      const denied = res.status === 401 || res.status === 403;
      const reconcileDisabled =
        action.id === 'data-hub-reconcile'
        && (res.status === 403 || res.status === 503)
        && /disabled|DATA_HUB_RECONCILE/i.test(JSON.stringify(res.data || {}));
      if (reconcileDisabled && expectAllow) {
        return probePass(
          { id: action.id, title: action.label, category: action.category },
          'Data Hub reconcile disabled in this environment (503)'
        );
      }
      const ok = expectAllow
        ? allowed || res.status === 404 || (res.status === 409 && action.method === 'POST')
        : denied || res.status === 404 || (res.status === 409 && action.url.includes('/crm/leads'));

      const detail = `${roleKey}: ${action.method} ${url} → ${res.status} (expect ${expectAllow ? 'allow' : 'deny'})`;
      const base = ok
        ? probePass({ id: action.id, title: action.label, category: action.category }, detail)
        : probeFail({ id: action.id, title: action.label, category: action.category, sev: action.sev }, detail, res.status);

      if (ctx.artifacts.length) return { ...base, artifacts: ctx.artifacts };
      return base;
    },
  };
}

async function buildPermissionMatrixTestCases(reportDiscovery) {
  const actions = getAllActions();
  const roles = Object.keys(getRoleDefs());
  const cases = [];

  for (const action of actions) {
    for (const roleKey of roles) {
      if (!action.allowedRoles?.length && !action.deniedRoles?.length) continue;
      if (action.allowedRoles?.includes(roleKey) || action.deniedRoles?.includes(roleKey)) {
        cases.push(matrixCase(action, roleKey));
      }
    }
  }

  if (reportDiscovery) {
    await reportDiscovery(`Permission matrix: ${cases.length} role×action checks`);
  }
  return cases;
}

module.exports = {
  buildPermissionMatrixTestCases,
  resolveRoleUser,
};
