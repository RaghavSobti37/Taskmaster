const { makeCheck, readText, readRepoText } = require('./qaCheckUtils');

/**
 * Suite 4 — v1.9.x feature static checks (OAuth, password reset, phone validation, perf tooling).
 */
async function runSuite4V19Checks() {
  const checks = [];
  const authRoutes = await readText('routes/authRoutes.js');
  const authCtrl = await readText('controllers/authController.js');
  const userModel = await readText('models/User.js');
  const appJsx = await readRepoText('client/src/App.jsx');
  const crmCtrl = await readText('controllers/crmController.js');
  const metaDel = await readText('controllers/metaDataDeletionController.js');
  const metaModel = await readText('models/MetaDeletionRequest.js');
  const intRoutes = await readText('routes/integrationsRoutes.js');
  const intVerify = await readText('controllers/integrationsVerifyController.js');
  const phoneVal = await readText('utils/phoneCountryValidation.js');
  const leadRepair = await readText('services/leadPhoneRepair.js');
  const widgetLoaders = await readRepoText('client/src/lib/dashboardWidgetLoaders.js');
  const bootFallback = await readRepoText('client/src/components/AppBootFallback.jsx');

  checks.push(
    makeCheck(
      'perf-dashboard-widget-loaders',
      'rollback',
      'Dashboard widgets use lazy loaders (v1.9.10)',
      widgetLoaders && widgetLoaders.includes('lazy') ? 'pass' : 'warn',
      'dashboardWidgetLoaders.js defers heavy widget chunks',
      'client/src/lib/dashboardWidgetLoaders.js',
      'low'
    ),
    makeCheck(
      'perf-app-boot-fallback',
      'rollback',
      'App boot fallback shell for lazy layout',
      bootFallback && appJsx && /AppBootFallback|lazy\(.*MainLayout/.test(appJsx) ? 'pass' : 'warn',
      'App.jsx uses AppBootFallback and lazy MainLayout',
      'client/src/App.jsx',
      'low'
    )
  );

  checks.push(
    makeCheck(
      'pwd-reset-routes-mounted',
      'password-reset',
      'Forgot/reset password routes mounted with rate limiter',
      authRoutes &&
        authRoutes.includes("'/forgot-password'") &&
        authRoutes.includes("'/reset-password'") &&
        authRoutes.includes('authForgotPasswordLimiter')
        ? 'pass'
        : 'fail',
      'POST /api/auth/forgot-password and /reset-password behind authForgotPasswordLimiter',
      'routes/authRoutes.js',
      'high'
    ),
    makeCheck(
      'pwd-reset-token-hashed',
      'password-reset',
      'Reset tokens stored hashed (SHA-256)',
      authCtrl && authCtrl.includes('hashResetToken') && authCtrl.includes("createHash('sha256')")
        ? 'pass'
        : 'fail',
      'authController hashes reset token before persisting',
      'controllers/authController.js',
      'high'
    ),
    makeCheck(
      'pwd-reset-expiry-configured',
      'password-reset',
      'Reset token TTL configured (1 hour)',
      authCtrl && authCtrl.includes('PASSWORD_RESET_EXPIRY_MS') && authCtrl.includes('passwordResetExpires')
        ? 'pass'
        : 'fail',
      'passwordResetExpires set on forgot; validated on reset',
      'controllers/authController.js',
      'high'
    ),
    makeCheck(
      'pwd-reset-single-use',
      'password-reset',
      'Reset clears token fields after successful reset',
      authCtrl &&
        authCtrl.includes('passwordResetToken = undefined') &&
        authCtrl.includes('passwordResetExpires = undefined')
        ? 'pass'
        : 'fail',
      'Token fields cleared after resetPassword succeeds',
      'controllers/authController.js',
      'high'
    ),
    makeCheck(
      'pwd-reset-user-schema-fields',
      'password-reset',
      'User schema has passwordResetToken + passwordResetExpires',
      userModel && userModel.includes('passwordResetToken') && userModel.includes('passwordResetExpires')
        ? 'pass'
        : 'fail',
      'User model stores hashed token + expiry (select:false)',
      'models/User.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'auth-oauth-establish-route',
      'authorization',
      'OAuth session establish endpoint (ticket exchange)',
      authRoutes && authRoutes.includes("'/oauth-establish'") && authCtrl && authCtrl.includes('oauthEstablishSession')
        ? 'pass'
        : 'fail',
      'POST /api/auth/oauth-establish sets httpOnly cookie after Google redirect',
      'routes/authRoutes.js',
      'high'
    ),
    makeCheck(
      'auth-google-success-page',
      'authorization',
      'Google OAuth success page route in client',
      appJsx && appJsx.includes('/auth/google/success') ? 'pass' : 'warn',
      'App.jsx mounts GoogleSuccessPage for ticket handoff',
      'client/src/App.jsx',
      'medium'
    ),
    makeCheck(
      'int-oauth-readiness-admin',
      'authorization',
      'Integrations OAuth readiness endpoint (admin-only)',
      intRoutes &&
        intRoutes.includes("'/oauth-readiness'") &&
        intRoutes.includes('admin') &&
        intVerify
        ? 'pass'
        : 'fail',
      'GET /api/integrations/oauth-readiness behind protect + admin',
      'routes/integrationsRoutes.js',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'meta-data-deletion-controller',
      'security-hardening',
      'Meta data deletion status controller exists',
      metaDel && metaDel.includes('handleDataDeletionCallback') ? 'pass' : 'fail',
      'metaDataDeletionController handles signed Meta deletion callbacks',
      'controllers/metaDataDeletionController.js',
      'high'
    ),
    makeCheck(
      'meta-deletion-request-model',
      'security-hardening',
      'MetaDeletionRequest model exists',
      metaModel && metaModel.includes('mongoose.model') ? 'pass' : 'fail',
      'MetaDeletionRequest.js tracks deletion confirmation codes',
      'models/MetaDeletionRequest.js',
      'medium'
    ),
    makeCheck(
      'fe-user-data-deletion-page',
      'security-hardening',
      'User data deletion public page wired',
      appJsx && appJsx.includes('/userdata') && (
        (await readRepoText('client/src/pages/legal/UserDataDeletion.jsx'))
        || (await readRepoText('client/src/pages/UserDataDeletion.jsx'))
      )
        ? 'pass'
        : 'warn',
      '/userdata route for Meta/Google deletion status lookup',
      'client/src/pages/legal/UserDataDeletion.jsx',
      'medium'
    )
  );

  checks.push(
    makeCheck(
      'crm-phone-country-validation',
      'input-validation',
      'Lead phone validated via phoneCountryValidation',
      phoneVal && crmCtrl && crmCtrl.includes('phoneCountryValidation') ? 'pass' : 'fail',
      'crmController uses phoneCountryValidation for E.164 national rules',
      'utils/phoneCountryValidation.js',
      'critical'
    ),
    makeCheck(
      'crm-lead-phone-repair-service',
      'business-logic',
      'Corrupt lead phone repair service exists',
      leadRepair && leadRepair.includes('repairCorruptLeadPhones') ? 'pass' : 'fail',
      'leadPhoneRepair strips -DUP-/EMPTY- suffixes during QA purge',
      'services/leadPhoneRepair.js',
      'high'
    ),
    makeCheck(
      'fe-forgot-reset-pages',
      'password-reset',
      'Forgot/reset password client pages and routes',
      appJsx &&
        appJsx.includes('/forgot-password') &&
        appJsx.includes('/reset-password') &&
        (await readRepoText('client/src/pages/auth/ForgotPasswordPage.jsx')) &&
        (await readRepoText('client/src/pages/auth/ResetPasswordPage.jsx'))
        ? 'pass'
        : 'fail',
      'ForgotPasswordPage + ResetPasswordPage mounted in App.jsx',
      'client/src/App.jsx',
      'medium'
    )
  );

  return checks;
}

module.exports = { runSuite4V19Checks };
