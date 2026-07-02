const fs = require('fs');
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { createRouteHandler } = require('uploadthing/express');
const { uploadRouter } = require('../config/uploadthing');
const { config } = require('../config');
const SystemHealthService = require('../services/SystemHealthService');
const traceMiddleware = require('../middleware/traceMiddleware');
const errorHandler = require('../middleware/errorMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { apiOk, apiError } = require('../utils/apiResponse');
const { uploadRateLimit } = require('../middleware/rateLimits');
const { protectUploadthingClient } = require('../middleware/uploadthingAuth');
const { apiIdempotency } = require('../middleware/apiIdempotency');

const crmUnsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many unsubscribe requests. Try again later.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email) return `crm-unsub:${email}`;
    return `crm-unsub-ip:${ipKeyGenerator(req)}`;
  },
});

/** Domain mount prefixes — used by startup banner. */
const API_DOMAINS = [
  'auth', 'projects', 'tasks', 'users', 'logs', 'teams', 'artists',
  'gamification', 'gamification-admin', 'qa', 'customization', 'crm', 'assets',
  'google', 'proxy', 'dashboard', 'calendar', 'departments', 'schedule',
  'notifications', 'notes', 'search', 'pinboard', 'mail', 'ses', 'tsc',
  'data-hub', 'artist-path', 'track', 'campaigns', 'analytics', 'webhooks',
  'integrations', 'office-assets', 'subscriptions', 'org-accounts', 'contacts',
  'exly', 'newsletter', 'finance', 'attendance', 'announcements', 'admin',
  'uploadthing',
];

function getApiDomainManifest() {
  return { domains: API_DOMAINS, count: API_DOMAINS.length };
}

/**
 * Route manifest — auth tiers:
 * - public: no protect middleware on router
 * - auth: /api/auth (login, register, OAuth)
 * - authenticated: protect on router (most /api/*)
 * - admin: protect + admin on router
 * - webhooks: signature-verified, no JWT (track, webhookRoutes)
 */
function registerRoutes(app) {
  // --- Public / health ---
  app.use('/api/v1', require('../routes/v1'));
  app.use('/api', require('../routes/openApiRoutes'));
  app.get('/api/health', (_req, res) => {
    const detail = SystemHealthService.getDetailedStatus();
    const healthy = detail.status === 'HEALTHY' || detail.status === 'STARTING';
    const payload = {
      status: detail.status,
      reason: detail.reason || null,
      dependencies: detail.dependencies,
      uptimeSeconds: detail.uptimeSeconds,
    };
    if (healthy) {
      return apiOk(res, payload, 200);
    }
    return apiError(res, detail.reason || 'Service unhealthy', 503, payload);
  });
  app.use('/api/', (req, res, next) => {
    if (req.path === '/health' || req.path === '/openapi.json') return next();
    // File uploads do not require Mongo — allow UploadThing route during DB reconnect blips.
    if (req.path.startsWith('/uploadthing')) return next();
    return SystemHealthService.middleware(req, res, next);
  });
  app.use(traceMiddleware);
  app.use('/api', apiIdempotency);

  // --- Auth (pre-logger) ---
  app.use('/api/auth', require('../domains/auth/routes'));
  app.use('/api/v1/sync', require('../routes/syncRoutes'));

  // --- Authenticated API ---
  app.use('/api/projects', require('../domains/projects/routes'));
  app.use('/api/tasks', require('../domains/tasks/routes'));
  app.use('/api/users', require('../domains/auth/userRoutes'));
  app.use('/api/logs', require('../routes/logRoutes'));
  app.use('/api/teams', require('../routes/teamRoutes'));
  app.use('/api/artists', require('../domains/artists/routes'));
  app.use('/api/auth', require('../domains/artists/connectRoutes'));
  app.use('/api/v2/artists', require('../domains/artists/v2Routes'));
  app.use('/api/gamification', require('../routes/gamificationRoutes'));
  app.use('/api/gamification-admin', require('../routes/gamificationAdminRoutes'));
  app.use('/api/qa', require('../routes/qaRoutes'));
  app.use('/api/customization', require('../routes/customizationRoutes'));

  // --- Webhooks & tracking (public, rate-limited) ---
  app.use(require('../routes/track'));
  app.post('/api/crm/unsubscribe', crmUnsubscribeLimiter, asyncHandler(async (req, res) => {
    const { email, reason } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const Lead = require('../domains/crm/models/Lead');
    const leadDoc = await Lead.findOne({ email: cleanEmail });
    const leadName = leadDoc ? leadDoc.name : '';
    await Lead.updateMany(
      { email: cleanEmail },
      { $set: { unsubscribed: true, unsubscribeReason: reason || 'Opt-out', emailStatus: 'Unsubscribed', status: 'inactive' } },
    );
    const { syncUnsubscribeToSheet } = require('../services/holySheetService');
    await syncUnsubscribeToSheet({
      email: cleanEmail,
      name: leadName,
      campaignId: 'CRM_MANUAL',
      reason: reason || 'Opt-out',
      unsubscribedAt: new Date(),
    });
    res.json({ success: true });
  }));

  app.use('/api/crm', require('../domains/crm/routes'));
  app.use('/api/assets', require('../routes/assetRoutes'));
  app.use('/api/google', require('../domains/integrations/googleRoutes'));
  app.use('/api/google/accounts', require('../domains/integrations/googleAccountsRoutes'));
  app.use('/api/proxy', require('../routes/proxyRoutes'));
  app.use('/api/dashboard', require('../domains/dashboard/routes'));
  app.use('/api/calendar', require('../routes/calendarRoutes'));
  app.use('/api/departments', require('../routes/departmentRoutes'));
  app.use('/api/schedule', require('../routes/scheduleRoutes'));
  app.use('/api/notifications', require('../routes/notificationRoutes'));
  app.use('/api/notes', require('../routes/noteRoutes'));
  app.use('/api/search', require('../routes/searchRoutes'));
  app.use('/api/pinboard', require('../routes/pinBoardRoutes'));
  const mailRoutes = require('../domains/mail/routes');
  app.use('/api/mail', mailRoutes.mail);
  app.use('/api/ses', require('../routes/sesRoutes'));
  app.use('/api/tsc', require('../routes/tscRoutes'));
  app.use('/api/data-hub', require('../domains/data-hub/routes'));
  app.use('/api/artist-path', require('../domains/artists/pathRoutes'));
  app.use('/api/track', require('../routes/track'));
  app.use('/api/campaigns', mailRoutes.campaigns);
  app.use('/api/analytics', require('../routes/analyticsRoutes'));
  app.use('/api/webhooks', require('../routes/webhookRoutes'));
  app.use('/api/integrations', require('../domains/integrations/integrationsRoutes'));
  app.use('/api/office-assets', require('../routes/officeAssetRoutes'));
  app.use('/api/subscriptions', require('../routes/subscriptionRoutes'));
  app.use('/api/org-accounts', require('../routes/orgAccountRoutes'));
  app.use('/api/contacts', require('../routes/contactRoutes'));
  app.use('/api/exly', require('../domains/integrations/exlyRoutes'));
  app.use('/api/newsletter', require('../routes/newsletterRoutes'));
  app.use('/api/finance', require('../routes/financeRoutes'));
  app.use('/api/attendance', require('../routes/attendanceRoutes'));
  app.use('/api/announcements', require('../routes/announcementRoutes'));
  app.use('/api/ops-hub', require('../routes/opsHubRoutes'));
  app.use('/api/knowledge-engine', require('../routes/knowledgeEngineRoutes'));

  // --- Admin ---
  app.use('/api/admin/media-contacts', require('../routes/mediaContactRoutes'));
  app.use('/api/admin/platform-settings', require('../routes/platformSettingsRoutes'));
  app.use('/api/admin/roles', require('../routes/adminRolesRoutes'));
  app.use('/api/admin/scripts', require('../routes/adminScriptsRoutes'));
  app.use('/api/admin/crm-stats', require('../routes/crmStatsRoutes'));
  app.use('/api/admin/supabase', require('../routes/supabaseAdminRoutes'));
  app.use('/api/admin/queues', require('../routes/queueAdminRoutes'));
  app.use('/api/admin/system-health', require('../routes/systemHealthAdminRoutes'));
  app.use('/api/admin/tenants', require('../routes/tenantAdminRoutes'));
  app.use('/api/admin/security-audit', require('../routes/securityAuditRoutes'));
  app.use('/api/admin', require('../routes/masterclassReviewAdminRoutes'));

  // UploadThing v7 requires Content-Type exactly 'application/json' when Express has already parsed req.body.
  app.use('/api/uploadthing', (req, _res, next) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      req.headers['content-type'] = 'application/json';
    } else {
      const contentType = req.headers['content-type'] || '';
      if (contentType.startsWith('application/json')) {
        req.headers['content-type'] = 'application/json';
      }
    }
    next();
  });
  app.use('/api/uploadthing', protectUploadthingClient);
  app.use('/api/uploadthing', uploadRateLimit, createRouteHandler({ router: uploadRouter }));

  if (config.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '..', '..', 'client', 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, {
        maxAge: '1y',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }));
      app.get('/{*path}', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.get('/', (req, res) => res.send(`CoreKnot API Active (Production backend online. Frontend build pending at: ${distPath})`));
    }
  } else {
    app.get('/', (req, res) => res.send('CoreKnot API Active (Development Mode)'));
  }

  app.use(errorHandler);
}

module.exports = { registerRoutes, getApiDomainManifest, API_DOMAINS };
