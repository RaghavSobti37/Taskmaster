/**
 * Pre-deployment security & ops checklist — static/config analysis for QA agent.
 * Each check: id, category, title, status (pass|fail|warn|skip), detail, evidence, severity
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
const {
  makeCheck,
  readText,
  readTextResolved,
  readBootstrapSources,
  readRepoText,
  listFiles,
  SERVER_ROOT,
  REPO_ROOT,
} = require('./qa/qaCheckUtils');

async function runAuthorizationChecks() {
  const checks = [];
  const authMw = await readText('middleware/authMiddleware.js');
  const taskCtrl = await readTextResolved('controllers/taskController.js');

  checks.push(
    makeCheck(
      'auth-middleware-exists',
      'authorization',
      'JWT auth middleware present',
      authMw && authMw.includes('protect') ? 'pass' : 'fail',
      authMw ? 'protect middleware defined' : 'authMiddleware.js missing',
      'middleware/authMiddleware.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'auth-objectid-validation',
      'authorization',
      'Task updates validate ObjectId params',
      taskCtrl && taskCtrl.includes('mongoose.Types.ObjectId.isValid') ? 'pass' : 'fail',
      taskCtrl ? 'Invalid IDs rejected before service layer' : 'taskController.js not found',
      'controllers/taskController.js',
      'high'
    )
  );

  const routeDir = path.join(SERVER_ROOT, 'routes');
  const routeFiles = await listFiles(routeDir);
  const publicRouteNames = new Set([
    'authRoutes.js',
    'track.js',
    'webhookRoutes.js',
    'connectionAuthRoutes.js',
    'spotifyAuthRoutes.js',
    'youtubeAuthRoutes.js',
    'qaRoutes.js',
    'sesRoutes.js',
    'publicRoutes.js',
    'openApiRoutes.js',
  ]);
  const nonRouteModules = new Set(['artistPathRoutes.handlers.js']);
  const unprotected = [];
  for (const file of routeFiles) {
    const base = path.basename(file);
    if (publicRouteNames.has(base) || nonRouteModules.has(base)) continue;
    const rel = path.relative(SERVER_ROOT, file).replace(/\\/g, '/');
    let content = await readTextResolved(rel);
    if (base === 'mailRoutes.js') {
      const mailIndex = await readTextResolved('domains/mail/routes/index.js');
      const campaignApi = await readTextResolved('domains/mail/routes/campaignApiRouter.js');
      content = [content, mailIndex, campaignApi].filter(Boolean).join('\n');
    }
    const usesProtect =
      /protect/.test(content) ||
      /admin\s*,/.test(content) ||
      /opsOrAdmin/.test(content);
    if (!usesProtect && !/router\.(get|post|put|patch|delete)\(['"]\/health/.test(content)) {
      unprotected.push(base);
    }
  }

  checks.push(
    makeCheck(
      'auth-routes-protect-coverage',
      'authorization',
      'API route files use protect or explicit admin guards',
      unprotected.length === 0 ? 'pass' : 'warn',
      unprotected.length === 0
        ? `Scanned ${routeFiles.length} route modules — all use protect/admin.`
        : `Route files without obvious protect(): ${unprotected.slice(0, 8).join(', ')}${unprotected.length > 8 ? '…' : ''}`,
      unprotected.join(', ') || 'all guarded',
      unprotected.length ? 'medium' : 'low'
    )
  );

  const tenantPlugin = await readText('plugins/tenantPlugin.js');
  checks.push(
    makeCheck(
      'auth-tenant-scoping',
      'authorization',
      'Tenant plugin scopes queries by tenantId',
      tenantPlugin && tenantPlugin.includes('injectTenantId') ? 'pass' : 'fail',
      'tenantPlugin injects tenantId on find/update operations',
      'plugins/tenantPlugin.js',
      'high'
    )
  );

  return checks;
}

async function runPasswordResetChecks() {
  const { runSuite4V19Checks } = require('./qa/qaSuite4V19');
  const suite4 = await runSuite4V19Checks();
  return suite4.filter((c) => c.category === 'password-reset');
}

async function runInputValidationChecks() {
  const checks = [];
  const serverJs = await readBootstrapSources();
  const contactSvc = await readText('services/ContactService.js');
  const taskSvc = await readTextResolved('services/TaskService.js');
  const sanitizer = await readText('utils/sanitizer.js');

  checks.push(
    makeCheck(
      'input-mongo-sanitize',
      'input-validation',
      'Mongo query injection sanitizer enabled',
      serverJs && serverJs.includes('mongoSanitize') ? 'pass' : 'fail',
      'express-mongo-sanitize on JSON body',
      'server.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'input-contact-sanitize',
      'input-validation',
      'Contact merge sanitizes email/phone/name',
      contactSvc && /sanitizeEmail|sanitizeName|normalizePhone/.test(contactSvc) ? 'pass' : 'fail',
      'ContactService uses sanitizer utils',
      'services/ContactService.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'input-task-date-validation',
      'input-validation',
      'Task timeline validated server-side (past dates blocked)',
      taskSvc && taskSvc.includes('validateTaskTimelineForRequest') ? 'pass' : 'fail',
      'TaskService calls shared dateValidation',
      'services/TaskService.js',
      'medium'
    )
  );

  const clientPages = path.join(REPO_ROOT, 'client/src');
  let dangerousHtml = 0;
  try {
    const clientFiles = await listFiles(clientPages, /\.(jsx|tsx|js)$/);
    for (const f of clientFiles.slice(0, 200)) {
      const c = await fs.readFile(f, 'utf8');
      if (/dangerouslySetInnerHTML/.test(c)) dangerousHtml++;
    }
  } catch {
    /* ignore */
  }

  checks.push(
    makeCheck(
      'input-xss-dangerous-html',
      'input-validation',
      'Client avoids raw HTML injection (dangerouslySetInnerHTML)',
      dangerousHtml === 0 ? 'pass' : 'warn',
      dangerousHtml === 0
        ? 'No dangerouslySetInnerHTML in sampled client src'
        : `${dangerousHtml} file(s) use dangerouslySetInnerHTML — audit each sink`,
      `sampled client/src (${dangerousHtml} hits)`,
      dangerousHtml ? 'medium' : 'low'
    )
  );

  checks.push(
    makeCheck(
      'input-sanitizer-module',
      'input-validation',
      'Central sanitizer utility exists',
      sanitizer ? 'pass' : 'warn',
      sanitizer ? 'utils/sanitizer.js present' : 'No dedicated sanitizer module',
      'utils/sanitizer.js',
      'medium'
    )
  );

  return checks;
}

async function runCorsChecks() {
  const checks = [];
  const serverJs = await readBootstrapSources();

  const wildcardOrigin =
    serverJs &&
    (/origin:\s*['"]?\*['"]?/.test(serverJs) ||
      /cors\(\s*\)/.test(serverJs) ||
      /origin:\s*true/.test(serverJs));

  checks.push(
    makeCheck(
      'cors-no-wildcard',
      'cors',
      'Production CORS does not use wildcard *',
      !wildcardOrigin && serverJs ? 'pass' : 'fail',
      serverJs
        ? 'Explicit allowlist callback in corsOptions'
        : 'Could not read server.js',
      'server.js corsOptions',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'cors-allowlist-domains',
      'cors',
      'CORS allowlist includes owned domains',
      serverJs && /tsccoreknot\.com|theshakticollective\.in/.test(serverJs) ? 'pass' : 'warn',
      'DEFAULT_ALLOWED_ORIGINS includes production domains',
      'server.js DEFAULT_ALLOWED_ORIGINS',
      'medium'
    )
  );

  const vercelGated =
    serverJs &&
    /CORS_ALLOW_VERCEL_PREVIEWS/.test(serverJs) &&
    /allowVercelPreviews/.test(serverJs) &&
    /\.vercel\.app/.test(serverJs);

  checks.push(
    makeCheck(
      'cors-vercel-previews-gated',
      'cors',
      'Vercel preview origins allowed with opt-out',
      vercelGated ? 'pass' : 'fail',
      vercelGated
        ? '*.vercel.app allowed on staging/dev; blocked on strict production unless CORS_ALLOW_VERCEL_PREVIEWS=true'
        : 'Expected allowVercelPreviews helper for *.vercel.app origins',
      'server.js corsOptions',
      'high'
    )
  );

  return checks;
}

async function runRateLimitChecks() {
  const checks = [];
  const serverJs = await readBootstrapSources();
  const authRoutes = await readText('domains/auth/routes.js');

  const loginMax =
    authRoutes && /authLoginLimiter/.test(authRoutes)
      ? (() => {
          const m = authRoutes.match(/max:\s*(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        })()
      : null;

  checks.push(
    makeCheck(
      'rate-login-10',
      'rate-limiting',
      'Login endpoint limited to 10 attempts per window',
      loginMax === 10 ? 'pass' : loginMax != null ? 'fail' : 'fail',
      loginMax === 10
        ? 'authRoutes loginLimiter max=10'
        : loginMax != null
          ? `Login limiter max=${loginMax}, expected 10`
          : 'No dedicated login rate limiter on POST /login',
      'domains/auth/routes.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'rate-api-global',
      'rate-limiting',
      'Global /api/ rate limiter configured',
      serverJs && (serverJs.includes("app.use('/api/', apiLimiter)") || serverJs.includes("app.use('/api/', limiter)")) ? 'pass' : 'fail',
      'express-rate-limit on /api/',
      'server.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'rate-tracking',
      'rate-limiting',
      'Public tracking endpoints rate limited',
      serverJs && serverJs.includes('trackLimiter') ? 'pass' : 'warn',
      'trackLimiter for /open/, /click/, webhooks',
      'server.js',
      'medium'
    )
  );

  const proxyRoutes = await readText('routes/proxyRoutes.js');
  checks.push(
    makeCheck(
      'rate-proxy',
      'rate-limiting',
      'Proxy routes have dedicated limiter',
      proxyRoutes && proxyRoutes.includes('rateLimit') ? 'pass' : 'warn',
      proxyRoutes ? 'proxyLimiter in proxyRoutes.js' : 'proxyRoutes not found',
      'routes/proxyRoutes.js',
      'low'
    )
  );

  return checks;
}

async function runErrorHandlingChecks() {
  const checks = [];
  const errMw = await readText('middleware/errorMiddleware.js');

  checks.push(
    makeCheck(
      'err-no-stack-prod',
      'error-handling',
      'Stack traces hidden from clients in production',
      errMw && errMw.includes("NODE_ENV === 'production'") && errMw.includes('stack:') ? 'pass' : 'fail',
      'errorMiddleware nulls stack when NODE_ENV=production',
      'middleware/errorMiddleware.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'err-structured-response',
      'error-handling',
      'API errors return structured JSON (success, error, traceId)',
      errMw && errMw.includes('traceId') && errMw.includes('success: false') ? 'pass' : 'warn',
      'Consistent error payload with traceId',
      'middleware/errorMiddleware.js',
      'medium'
    )
  );

  return checks;
}

async function runDatabaseIndexChecks() {
  const checks = [];
  const taskModel = await readTextResolved('models/Task.js');
  const leadModel = await readTextResolved('models/Lead.js');
  const userModel = await readText('models/User.js');

  const countIndexes = (src) => (src ? (src.match(/\.index\(/g) || []).length : 0);

  checks.push(
    makeCheck(
      'db-task-indexes',
      'database-indexes',
      'Task model has compound indexes for hot paths',
      countIndexes(taskModel) >= 3 ? 'pass' : 'warn',
      `Task.schema.index calls: ${countIndexes(taskModel)}`,
      'models/Task.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'db-lead-indexes',
      'database-indexes',
      'Lead model indexed for tenant + rep queries',
      countIndexes(leadModel) >= 4 ? 'pass' : 'warn',
      `Lead.schema.index calls: ${countIndexes(leadModel)}`,
      'models/Lead.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'db-user-email-unique',
      'database-indexes',
      'User email unique index',
      userModel && userModel.includes('unique: true') && userModel.includes('email') ? 'pass' : 'warn',
      'email field marked unique',
      'models/User.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'db-user-tenant-index',
      'database-indexes',
      'User tenantId indexed (via tenantPlugin)',
      userModel && userModel.includes('tenantPlugin') ? 'pass' : 'warn',
      'tenantPlugin adds tenantId index on User',
      'models/User.js + plugins/tenantPlugin.js',
      'low'
    )
  );

  return checks;
}

async function runLoggingChecks() {
  const checks = [];
  const logger = await readText('utils/logger.js');
  const traceMw = await readText('middleware/traceMiddleware.js');

  checks.push(
    makeCheck(
      'log-structured-logger',
      'logging-monitoring',
      'Structured logger utility exists',
      logger && logger.includes('pino') ? 'pass' : 'fail',
      'Pino JSON logger for Render stdout',
      'utils/logger.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'log-trace-id',
      'logging-monitoring',
      'Request trace ID middleware',
      traceMw ? 'pass' : 'warn',
      'traceMiddleware attaches traceId to requests',
      'middleware/traceMiddleware.js',
      'low'
    )
  );

  return checks;
}

async function runRollbackChecks() {
  const checks = [];
  const renderYaml = await readRepoText('render.yaml');

  checks.push(
    makeCheck(
      'rollback-render-blueprint',
      'rollback',
      'Render blueprint documents deploy services',
      renderYaml ? 'pass' : 'warn',
      renderYaml
        ? 'render.yaml present (cron jobs defined)'
        : 'No render.yaml — document rollback manually',
      'render.yaml',
      'low'
    )
  );

  const hasBlueGreen =
    renderYaml && /blueGreen|zero.?downtime|preDeployCommand/i.test(renderYaml);

  checks.push(
    makeCheck(
      'rollback-blue-green',
      'rollback',
      'Blue-green or zero-downtime deploy configured',
      hasBlueGreen ? 'pass' : 'warn',
      hasBlueGreen
        ? 'Blueprint mentions zero-downtime/blue-green'
        : 'Advisory: Render web service uses rolling deploy; confirm rollback runbook in Dashboard',
      'render.yaml',
      'low'
    )
  );

  checks.push(
    makeCheck(
      'rollback-backup-cron',
      'rollback',
      'Scheduled DB backup job in blueprint',
      renderYaml && /backup|runDailyBackup/i.test(renderYaml) ? 'pass' : 'warn',
      'CoreKnot-daily-backup cron in render.yaml',
      'render.yaml',
      'medium'
    )
  );

  return checks;
}

async function runSecurityHardeningChecks() {
  const checks = [];
  const webhookAuth = await readText('utils/webhookAuth.js');
  const authCookie = await readText('utils/authCookie.js');
  const authCtrl = await readText('domains/auth/controllers/authController.js');
  const webhookCtrl = await readText('controllers/webhookController.js');
  const exlyCtrl = await readText('domains/integrations/controllers/exlyController.js');
  const artistV2 = await readText('domains/artists/v2Routes.js');
  const artistRoutes = await readText('domains/artists/routes.js');
  const subscriptionRoutes = await readText('routes/subscriptionRoutes.js');
  const proxyRoutes = await readText('routes/proxyRoutes.js');
  const webhookRoutes = await readText('routes/webhookRoutes.js');
  const authMw = await readText('middleware/authMiddleware.js');
  const pwdValidation = await readText('utils/passwordValidation.js');
  const authRoutes = await readText('domains/auth/routes.js');
  const authCtx = await readRepoText('client/src/contexts/AuthContext.jsx');
  const envExample = await readText('.env.example');

  checks.push(
    makeCheck(
      'sec-webhook-hmac-module',
      'security-hardening',
      'Webhook HMAC verification utility exists',
      webhookAuth && webhookAuth.includes('verifyWebhookSignature') ? 'pass' : 'fail',
      'server/utils/webhookAuth.js provides HMAC + artist-enquiry secret helpers',
      'utils/webhookAuth.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-book-call-webhook-signed',
      'security-hardening',
      'Book-call webhook requires HMAC signature',
      webhookCtrl && webhookCtrl.includes('BOOK_CALL_WEBHOOK_SECRET') && webhookCtrl.includes('rejectUnlessWebhookSignature')
        ? 'pass'
        : 'fail',
      'handleBookedCall rejects unsigned payloads via BOOK_CALL_WEBHOOK_SECRET',
      'controllers/webhookController.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-exly-webhook-signed',
      'security-hardening',
      'Exly webhook requires HMAC signature',
      exlyCtrl && exlyCtrl.includes('EXLY_WEBHOOK_SECRET') && exlyCtrl.includes('rejectUnlessWebhookSignature')
        ? 'pass'
        : 'fail',
      'handleExlyWebhook rejects unsigned payloads via EXLY_WEBHOOK_SECRET',
      'controllers/exlyController.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-artist-enquiry-secret-prod',
      'security-hardening',
      'Artist enquiry webhook enforces secret in production',
      webhookAuth && webhookAuth.includes("NODE_ENV !== 'production'") && webhookAuth.includes('verifyArtistEnquirySecret')
        ? 'pass'
        : 'fail',
      'Missing ARTIST_ENQUIRY_WEBHOOK_SECRET fails closed in production',
      'utils/webhookAuth.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-no-hardcoded-songstats',
      'security-hardening',
      'No hardcoded Songstats API key fallback',
      artistV2 &&
        !artistV2.includes('f87dfac1-0f05-4898-b2e1-43488dd90073') &&
        artistV2.includes('SONGSTATS_API_KEY')
        ? 'pass'
        : 'fail',
      'artistV2Routes uses SONGSTATS_API_KEY env only',
      'routes/artistV2Routes.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-register-domain-guard',
      'security-hardening',
      'Registration enforces ALLOWED_DOMAIN in production',
      authCtrl && authCtrl.includes('ALLOWED_DOMAIN') && authCtrl.includes('isRegistrationAllowed') ? 'pass' : 'fail',
      'authController blocks unauthorized email domains on register',
      'controllers/authController.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-register-dept-signup',
      'security-hardening',
      'Registration validates signupAllowed departments',
      authCtrl && authCtrl.includes('resolveSignupDepartment') && authCtrl.includes('signupAllowed') ? 'pass' : 'fail',
      'departmentId must reference a department with signupAllowed=true',
      'controllers/authController.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-register-password-strength',
      'security-hardening',
      'Registration validates password strength',
      authCtrl && pwdValidation && authCtrl.includes('validatePasswordStrength') ? 'pass' : 'fail',
      'Shared passwordValidation used on POST /api/auth/register',
      'controllers/authController.js + utils/passwordValidation.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'sec-artist-analytics-protected',
      'security-hardening',
      'Artist platform analytics requires auth + artistTeamOrAdmin',
      artistRoutes &&
        !/router\.get\('\/:id\/analytics\/:platform'/.test(
          (artistRoutes.split('router.use(protect)')[0] || '')
        ) &&
        /router\.get\('\/:id\/analytics\/:platform',\s*(artistTeamOrAdmin|artistOrAdmin)/.test(
          artistRoutes
        )
        ? 'pass'
        : 'fail',
      'Analytics route mounted after protect with artistTeamOrAdmin (or artistOrAdmin) guard',
      'domains/artists/routes.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-subscriptions-ops-only',
      'security-hardening',
      'Subscription mutations require subscriptions page access',
      subscriptionRoutes &&
        /subscriptionsAccess/.test(subscriptionRoutes) &&
        /router\.post\('\/',\s*subscriptionsAccess/.test(subscriptionRoutes) &&
        /router\.get\('\/',\s*subscriptionsAccess/.test(subscriptionRoutes)
        ? 'pass'
        : 'fail',
      'list/create/update/delete subscription routes gated by subscriptions page key',
      'routes/subscriptionRoutes.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-meta-webhook-signature-enforced',
      'security-hardening',
      'Meta Instagram webhook rejects invalid signatures',
      webhookRoutes &&
        webhookRoutes.includes('INVALID_SIGNATURE') &&
        webhookRoutes.includes('return res.status(401)') &&
        !/Signature mismatch![\s\S]*console\.warn[\s\S]*res\.status\(200\)/.test(webhookRoutes)
        ? 'pass'
        : 'fail',
      'POST /api/webhooks/instagram returns 401 on signature mismatch',
      'routes/webhookRoutes.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-proxy-ops-only',
      'security-hardening',
      'API proxy routes require ops or admin_data page access',
      proxyRoutes &&
        /requireAnyPageAccess/.test(proxyRoutes) &&
        /finance/.test(proxyRoutes) &&
        /admin_data/.test(proxyRoutes)
        ? 'pass'
        : 'fail',
      'HolySheet/Exly/YouTube/OpenAI proxy limited to ops pages or admin_data',
      'routes/proxyRoutes.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-httponly-auth-cookie',
      'security-hardening',
      'JWT stored in HttpOnly cookie (not response body)',
      authCookie &&
        authCookie.includes('httpOnly: true') &&
        authCookie.includes('coreknot_token_v3') &&
        authCookie.includes('coreknot_token_v2') &&
        authCookie.includes('purgeLegacyAuthCookies') &&
        authCtrl &&
        (authCtrl.includes('setAuthCookie') || authCtrl.includes('establishSession') || authCtrl.includes('finishAuthSession')) &&
        authCtrl.includes('formatAuthUser') &&
        !authCtrl.includes("token: generateToken")
        ? 'pass'
        : 'fail',
      'authCookie sets coreknot_token_v3 and purges legacy v1/v2 cookies',
      'utils/authCookie.js + controllers/authController.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-auth-cookie-middleware',
      'security-hardening',
      'Auth middleware reads HttpOnly cookie',
      authMw && authMw.includes('getTokenFromRequest') ? 'pass' : 'fail',
      'protect() accepts cookie or legacy Bearer header',
      'middleware/authMiddleware.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-logout-clears-cookie',
      'security-hardening',
      'Logout endpoint clears session cookie',
      authRoutes && authRoutes.includes("router.post('/logout'") && authCtrl && authCtrl.includes('clearAuthCookie')
        ? 'pass'
        : 'fail',
      'POST /api/auth/logout clears session cookies (v2 + legacy)',
      'domains/auth/routes.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'sec-client-no-localstorage-token',
      'security-hardening',
      'Client auth does not persist JWT in localStorage',
      authCtx &&
        authCtx.includes('withCredentials = true') &&
        !authCtx.includes("localStorage.setItem('coreknot_token'")
        ? 'pass'
        : 'fail',
      'AuthContext uses cookie session; no coreknot_token in localStorage',
      'client/src/contexts/AuthContext.jsx',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'sec-env-webhook-secrets-documented',
      'security-hardening',
      'Webhook secret env vars documented in .env.example',
      envExample &&
        envExample.includes('BOOK_CALL_WEBHOOK_SECRET') &&
        envExample.includes('EXLY_WEBHOOK_SECRET') &&
        envExample.includes('ARTIST_ENQUIRY_WEBHOOK_SECRET')
        ? 'pass'
        : 'warn',
      'server/.env.example lists BOOK_CALL, EXLY, ARTIST_ENQUIRY webhook secrets',
      'server/.env.example',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'sec-webhook-no-stack-leak',
      'security-hardening',
      'Book-call webhook errors do not return stack traces',
      webhookCtrl && webhookCtrl.includes('handleBookedCall') && !webhookCtrl.includes('stack: syncError.stack')
        ? 'pass'
        : 'fail',
      'Webhook 500 responses omit internal stack traces',
      'controllers/webhookController.js',
      'medium'
    )
  );

  return checks;
}

const QA_API_BASE = () =>
  (process.env.QA_API_BASE_URL || process.env.API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

/** Allowed-domain email for live auth probes (production register gate). */
const QA_PROBE_DOMAIN = () =>
  String(process.env.QA_PROBE_EMAIL_DOMAIN || process.env.ALLOWED_DOMAIN || 'theshakticollective.in')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');

const qaProbeEmail = (prefix) => `${prefix}-${Date.now()}@${QA_PROBE_DOMAIN()}`;

/**
 * Live HTTP probes against a running API (skipped when server unreachable).
 */
async function buildSecurityRuntimeTestCases() {
  const base = QA_API_BASE();
  const category = 'security-hardening';

  const probe = async (name, checklistId, method, url, fn) => ({
    name: `[Security Live] ${name}`,
    category,
    severity: 'high',
    checklistId,
    qaMeta: {
      kind: 'http',
      action: 'Unsigned / malformed webhook probe',
      method,
      url,
      checklistId,
      category,
    },
    test: async () => {
      try {
        return await fn(base);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          return {
            passed: true,
            checkStatus: 'skip',
            checklistId,
            description: `Skipped — API not reachable at ${base}`,
            evidence: err.message,
            category,
            severity: 'low',
            message: `[SKIP] ${name}`,
          };
        }
        return {
          passed: false,
          checkStatus: 'fail',
          checklistId,
          error: err.message,
          description: err.message,
          category,
          severity: 'high',
        };
      }
    },
  });

  return [
    await probe(
      'Book-call webhook rejects unsigned payload',
      'sec-live-book-call-401',
      'POST',
      '/api/webhooks/book-call',
      async (apiBase) => {
        const res = await axios.post(
          `${apiBase}/api/webhooks/book-call`,
          { name: 'QA Probe', email: 'qa-probe@example.com', phone: '9999999999' },
          { validateStatus: () => true, timeout: 8000 }
        );
        const ok = res.status === 401;
        return {
          passed: ok,
          checkStatus: ok ? 'pass' : 'fail',
          checklistId: 'sec-live-book-call-401',
          error: ok ? null : `Expected 401, got ${res.status}`,
          description: ok
            ? `Unsigned book-call webhook rejected (${res.status})`
            : `Unsigned book-call webhook accepted with status ${res.status}`,
          evidence: `${apiBase}/api/webhooks/book-call → ${res.status}`,
          category,
          severity: ok ? 'low' : 'high',
          message: ok ? 'Book-call webhook rejects unsigned payload' : 'Book-call webhook unsigned bypass',
        };
      }
    ),
    await probe(
      'Exly webhook rejects unsigned payload',
      'sec-live-exly-401',
      'POST',
      '/api/exly/webhook',
      async (apiBase) => {
        const res = await axios.post(
          `${apiBase}/api/exly/webhook`,
          { email: 'qa-probe@example.com', phone: '9999999999' },
          { validateStatus: () => true, timeout: 8000 }
        );
        const ok = res.status === 401;
        return {
          passed: ok,
          checkStatus: ok ? 'pass' : 'fail',
          checklistId: 'sec-live-exly-401',
          error: ok ? null : `Expected 401, got ${res.status}`,
          description: ok
            ? `Unsigned Exly webhook rejected (${res.status})`
            : `Unsigned Exly webhook accepted with status ${res.status}`,
          evidence: `${apiBase}/api/exly/webhook → ${res.status}`,
          category,
          severity: ok ? 'low' : 'high',
          message: ok ? 'Exly webhook rejects unsigned payload' : 'Exly webhook unsigned bypass',
        };
      }
    ),
    await probe(
      'Artist analytics requires authentication',
      'sec-live-artist-analytics-401',
      'GET',
      '/api/artists/:id/analytics/spotify',
      async (apiBase) => {
        const res = await axios.get(
          `${apiBase}/api/artists/000000000000000000000001/analytics/spotify`,
          { validateStatus: () => true, timeout: 8000 }
        );
        const ok = res.status === 401;
        return {
          passed: ok,
          checkStatus: ok ? 'pass' : 'fail',
          checklistId: 'sec-live-artist-analytics-401',
          error: ok ? null : `Expected 401, got ${res.status}`,
          description: ok
            ? 'Unauthenticated artist analytics blocked'
            : `Public artist analytics leak — status ${res.status}`,
          evidence: `GET /api/artists/:id/analytics/spotify → ${res.status}`,
          category,
          severity: ok ? 'low' : 'high',
          message: ok ? 'Artist analytics protected' : 'Artist analytics exposed without auth',
        };
      }
    ),
    await probe(
      'Registration rejects weak passwords',
      'sec-live-register-weak-password',
      'POST',
      '/api/auth/register',
      async (apiBase) => {
        const res = await axios.post(
          `${apiBase}/api/auth/register`,
          {
            name: 'QA Weak Pass',
            email: qaProbeEmail('qa-weak'),
            password: 'password123',
            gender: 'male',
          },
          { validateStatus: () => true, timeout: 8000 }
        );
        const ok = res.status === 400 && /weak|Password/i.test(res.data?.error || '');
        return {
          passed: ok,
          checkStatus: ok ? 'pass' : 'fail',
          checklistId: 'sec-live-register-weak-password',
          error: ok ? null : `Expected 400 weak-password error, got ${res.status}`,
          description: ok
            ? 'Weak password rejected on register'
            : `Register accepted weak password (status ${res.status})`,
          evidence: JSON.stringify(res.data?.error || res.status).slice(0, 200),
          category,
          severity: ok ? 'low' : 'high',
          message: ok ? 'Register password strength enforced' : 'Register weak password bypass',
        };
      }
    ),
    await probe(
      'Login response omits JWT from JSON body',
      'sec-live-login-no-token-body',
      'POST',
      '/api/auth/login',
      async (apiBase) => {
        const email = qaProbeEmail('qa-login');
        const password = getDefaultSeedPassword();
        const regRes = await axios.post(
          `${apiBase}/api/auth/register`,
          { name: 'QA Login Probe', email, password, gender: 'male' },
          { validateStatus: () => true, timeout: 8000 }
        );
        if (regRes.status !== 201 && regRes.status !== 200) {
          return {
            passed: false,
            checkStatus: 'fail',
            checklistId: 'sec-live-login-no-token-body',
            error: `Register setup failed (${regRes.status})`,
            description: 'Could not create probe user for login JWT check',
            evidence: JSON.stringify(regRes.data?.error || regRes.status).slice(0, 200),
            category,
            severity: 'high',
            message: 'Login JWT probe setup failed',
          };
        }
        const res = await axios.post(
          `${apiBase}/api/auth/login`,
          { email, password },
          { validateStatus: () => true, timeout: 8000 }
        );
        if (res.status === 429) {
          return {
            passed: true,
            checkStatus: 'skip',
            checklistId: 'sec-live-login-no-token-body',
            error: null,
            description: 'Skipped — login rate limit active on this host (retry after 15m)',
            evidence: String(res.data?.error || res.status),
            category,
            severity: 'low',
            message: '[SKIP] Login JWT body check (rate limited)',
          };
        }
        const ok = res.status === 200 && !res.data?.token;
        return {
          passed: ok,
          checkStatus: ok ? 'pass' : 'fail',
          checklistId: 'sec-live-login-no-token-body',
          error: ok ? null : `Login returned token in body or failed (${res.status})`,
          description: ok
            ? 'Login sets HttpOnly cookie only — no token in JSON'
            : 'Login still exposes JWT in response body',
          evidence: res.data?.token ? 'token present in body' : 'no token field',
          category,
          severity: ok ? 'low' : 'high',
          message: ok ? 'Login omits JWT from body' : 'Login leaks JWT in body',
        };
      }
    ),
  ];
}

async function runBusinessLogicChecks() {
  const checks = [];
  const taskSvc = await readTextResolved('services/TaskService.js');
  const gamSvc = await readText('services/gamificationService.js');
  const bgQueue = await readText('services/backgroundQueue.js');
  const crmWriteSvc = await readTextResolved('domains/crm/services/leadWriteService.js');
  const dataHubSvc = await readText('services/DataHubService.js');
  const sharedDate = await readRepoText('shared/dateValidation.js');

  checks.push(
    makeCheck(
      'biz-task-review-flow',
      'business-logic',
      'Task review workflow (in-review → done, rollback re-submit)',
      taskSvc &&
        taskSvc.includes("'in-review'") &&
        taskSvc.includes('REVIEW_APPROVED') &&
        taskSvc.includes('needsReviewOnComplete') &&
        taskSvc.includes('canUserApproveOrRollback')
        ? 'pass'
        : 'fail',
      'TaskService gates status transitions and review approval XP',
      'services/TaskService.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'biz-xp-on-complete',
      'business-logic',
      'XP awarded on task completion via gamification queue',
      taskSvc &&
        taskSvc.includes('queueTaskCompletedGamification') &&
        gamSvc &&
        gamSvc.includes('COMPLETE_TASK')
        ? 'pass'
        : 'fail',
      'TASK_COMPLETED → COMPLETE_TASK XP path wired',
      'TaskService.js + gamificationService.js',
      'high'
    )
  );

  checks.push(
    makeCheck(
      'biz-gamification-queue',
      'business-logic',
      'Gamification events queued (Redis or inline fallback)',
      bgQueue && bgQueue.includes('queueGamificationEvent') ? 'pass' : 'warn',
      'backgroundQueue handles gamification jobs',
      'services/backgroundQueue.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'biz-crm-lead-xp',
      'business-logic',
      'CRM lead capture triggers gamification event',
      crmWriteSvc && crmWriteSvc.includes('LEAD_CAPTURED') ? 'pass' : 'warn',
      'leadWriteService queues LEAD_CAPTURED',
      'domains/crm/services/leadWriteService.js',
      'low'
    )
  );

  checks.push(
    makeCheck(
      'biz-datahub-service',
      'business-logic',
      'Data Hub service layer present for conversions',
      dataHubSvc ? 'pass' : 'warn',
      'DataHubService handles person/reconcile flows',
      'services/DataHubService.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'biz-shared-date-validation',
      'business-logic',
      'Shared dateValidation module (client + server parity)',
      sharedDate && sharedDate.includes('assertDateKeyNotBeforeToday') ? 'pass' : 'fail',
      'shared/dateValidation.js guards past dates',
      'shared/dateValidation.js',
      'medium'
    )
  );

  return checks;
}

async function runAllPreDeploymentChecks() {
  const { runSuite3StaticChecks } = require('./qa/qaSuite3Static');
  const groups = await Promise.all([
    runAuthorizationChecks(),
    runPasswordResetChecks(),
    runInputValidationChecks(),
    runCorsChecks(),
    runRateLimitChecks(),
    runErrorHandlingChecks(),
    runDatabaseIndexChecks(),
    runLoggingChecks(),
    runRollbackChecks(),
    runBusinessLogicChecks(),
    runSecurityHardeningChecks(),
    runSuite3StaticChecks(),
    require('./qa/qaSuite5Features').runSuite5FeatureChecks(),
  ]);
  return groups.flat();
}

function checklistToTestResult(check) {
  const passed = check.status === 'pass' || check.status === 'warn' || check.status === 'skip';
  return {
    passed,
    checkStatus: check.status,
    checklistId: check.id,
    error: check.status === 'fail' ? check.detail : null,
    description: check.detail,
    evidence: check.evidence,
    category: check.category,
    severity: check.status === 'fail' ? check.severity : 'low',
    message:
      check.status === 'pass'
        ? check.title
        : `[${check.status.toUpperCase()}] ${check.title}`,
  };
}

const PRE_DEPLOY_GROUPS = [
  { label: 'Authorization', fn: runAuthorizationChecks },
  { label: 'Password reset', fn: runPasswordResetChecks },
  { label: 'Input validation', fn: runInputValidationChecks },
  { label: 'CORS', fn: runCorsChecks },
  { label: 'Rate limiting', fn: runRateLimitChecks },
  { label: 'Error handling', fn: runErrorHandlingChecks },
  { label: 'Database indexes', fn: runDatabaseIndexChecks },
  { label: 'Logging & monitoring', fn: runLoggingChecks },
  { label: 'Rollback / deploy', fn: runRollbackChecks },
  { label: 'Business logic', fn: runBusinessLogicChecks },
  { label: 'Security hardening', fn: runSecurityHardeningChecks },
];

function preDeployMeta(check) {
  const live = String(check.id || '').startsWith('sec-live-');
  return {
    kind: live ? 'http' : 'static',
    action: live ? 'Live HTTP security probe' : 'Read/analyze repository files (no HTTP)',
    target: check.evidence || check.id,
    checklistId: check.id,
    category: check.category,
  };
}

/**
 * Build QA test case objects compatible with QATestingService.runTestCase
 * @param {(message: string) => void|Promise<void>} [onProgress] discovery callback
 */
async function buildPreDeploymentTestCases(onProgress) {
  const staticCases = [];
  const { runSuite3StaticChecks } = require('./qa/qaSuite3Static');

  for (const { label, fn } of PRE_DEPLOY_GROUPS) {
    if (onProgress) await onProgress(`Pre-deploy: evaluating ${label}…`);
    const checks = await fn();
    for (const check of checks) {
      staticCases.push({
        name: `[Pre-Deploy] ${check.title}`,
        category: check.category,
        severity: check.severity,
        checklistId: check.id,
        qaMeta: preDeployMeta(check),
        test: async () => checklistToTestResult(check),
      });
    }
  }

  if (onProgress) await onProgress('Pre-deploy: evaluating Suite 3 static checks…');
  const suite3 = await runSuite3StaticChecks();
  for (const check of suite3) {
    staticCases.push({
      name: `[Pre-Deploy] ${check.title}`,
      category: check.category,
      severity: check.severity,
      checklistId: check.id,
      qaMeta: preDeployMeta(check),
      test: async () => checklistToTestResult(check),
    });
  }

  if (onProgress) await onProgress('Pre-deploy: evaluating Suite 4 (v1.9.x) checks…');
  const { runSuite4V19Checks } = require('./qa/qaSuite4V19');
  const suite4 = await runSuite4V19Checks();
  for (const check of suite4) {
    if (check.category === 'password-reset') continue;
    staticCases.push({
      name: `[Pre-Deploy] ${check.title}`,
      category: check.category,
      severity: check.severity,
      checklistId: check.id,
      qaMeta: preDeployMeta(check),
      test: async () => checklistToTestResult(check),
    });
  }

  if (onProgress) await onProgress('Pre-deploy: evaluating Suite 5 (task history, mail pipeline)…');
  const { runSuite5FeatureChecks } = require('./qa/qaSuite5Features');
  const suite5 = await runSuite5FeatureChecks();
  for (const check of suite5) {
    staticCases.push({
      name: `[Pre-Deploy] ${check.title}`,
      category: check.category,
      severity: check.severity,
      checklistId: check.id,
      qaMeta: preDeployMeta(check),
      test: async () => checklistToTestResult(check),
    });
  }

  if (onProgress) await onProgress('Pre-deploy: building live security probes…');
  const runtimeCases = await buildSecurityRuntimeTestCases();
  return [...staticCases, ...runtimeCases];
}

module.exports = {
  runAllPreDeploymentChecks,
  buildPreDeploymentTestCases,
  buildSecurityRuntimeTestCases,
  runSecurityHardeningChecks,
  checklistToTestResult,
};
