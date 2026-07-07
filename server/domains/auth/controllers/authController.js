const User = require('../../../models/User');
const Department = require('../../../models/Department');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { google } = require('googleapis');
const logger = require('../../../utils/logger');
const { clearAuthCookie, hadAuthCookie, getTokenFromRequest } = require('../../../utils/authCookie');
const {
  verifySessionToken,
  generateSessionToken,
  resolveLoginAt,
} = require('../../../utils/authSession');
const { setAuthCookie } = require('../../../utils/authCookie');
const { finishAuthSession, listUserSessions, removeSession, ensureSession } = require('../../../utils/sessionRegistry');
const { createOAuth2Client, resolveGoogleRedirectUri } = require('../../../utils/googleAuth');
const { validatePasswordStrength } = require('../../../utils/passwordValidation');
const { normalizePasswordInput, passwordCandidatesForCompare } = require('../../../utils/passwordAuth');
const { normalizePersonName } = require('../../../utils/sanitizer');
const { attachProfileCompletion } = require('../../../utils/profileCompleteness');
const { getDefaultSeedPassword } = require('../../../utils/defaultPassword');
const { sendSystemEmail } = require('../../../utils/sendSystemEmail');
const { apiError } = require('../../../utils/apiResponse');
const { captureEvent: capturePostHogEvent, identifyServerUser } = require('../../../utils/posthog');
const {
  isClerkConfigured,
  verifyClerkSessionToken,
  clerkTokenInstanceMismatchMessage,
  resolveUserFromClerkProfile,
} = require('../../../utils/clerkAuth');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const {
  resolveClerkOrganizationId,
  resolveTenantForOrganization,
  ensureClerkOrganizationAccess,
  shouldEnforceClerkOrganization,
} = require('../../../utils/organizationAccess');
const { syncClerkUserPassword } = require('../../../utils/clerkUserProvisioning');

const { assertEstablishAllowed } = require('../utils/establishAccess');
const { isClerkProductionAuth, respondClerkOnlyAuth } = require('../../../utils/clerkOnlyAuth');
const asyncHandler = require('../../../middleware/asyncHandler');

const blockLegacyAuth = (res) => {
  if (isClerkProductionAuth()) {
    respondClerkOnlyAuth(res);
    return true;
  }
  return false;
};

const getSessionCookie = (req) => req.cookies?.[require('../../../utils/authCookie').COOKIE_NAME] || null;

const { isE2eTestUser } = require('../../../utils/e2eTestUsers');

const generateOAuthTicket = (id) => jwt.sign(
  { id, purpose: 'oauth_establish' },
  process.env.JWT_SECRET,
  { expiresIn: '120s' },
);

const verifyOAuthTicket = (ticket) => {
  const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
  if (decoded.purpose !== 'oauth_establish' || !decoded.id) {
    throw new Error('Invalid OAuth ticket');
  }
  return decoded.id;
};

const { resolveAuthFrontendUrl } = require('../../../utils/oauthEnv');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();
const PASSWORD_RESET_CC = ADMIN_EMAIL || 'REDACTED_ADMIN@example.com';
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildPasswordResetEmailHtml = ({ name, resetUrl }) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0d9488; margin-bottom: 8px;">Reset your Coreknot password</h2>
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset your Coreknot account password. Click the button below to choose a new password.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background: #0d9488; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; display: inline-block;">
        Reset password
      </a>
    </p>
    <p style="font-size: 13px; color: #666;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
    <p style="font-size: 12px; color: #999; word-break: break-all;">${resetUrl}</p>
  </div>
`;

const formatAuthUser = (populated) => attachProfileCompletion(
  populated.toObject ? populated.toObject() : populated
);

const attachActiveTenantFields = async (payload, activeTenantId) => {
  const { resolveActiveTenantSlug } = require('../../../services/orgContextService');
  payload.activeTenantId = activeTenantId ? String(activeTenantId) : null;
  payload.activeTenantSlug = activeTenantId
    ? await resolveActiveTenantSlug(activeTenantId)
    : null;
  return payload;
};

const sendAuthSuccess = async (req, res, populated, { authMethod, clerkActiveTenantId } = {}) => {
  const { assertLoginAllowed } = require('../../../services/tenantSecurityService');
  try {
    await assertLoginAllowed({ req, user: populated, authMethod });
  } catch (err) {
    return apiError(res, err.message, err.status || 403);
  }

  const {
    backfillMembershipFromUser,
    ensureMembershipForTenant,
    listActiveMemberships,
    resolveInitialActiveTenantId,
  } = require('../../../services/tenantMembershipService');
  if (clerkActiveTenantId) {
    await ensureMembershipForTenant(populated._id, clerkActiveTenantId);
  }
  await backfillMembershipFromUser(populated);
  const memberships = await listActiveMemberships(populated._id);
  const orgFirst = require('../../../utils/orgFirstAuth').isOrgFirstAuthEnabled();

  let activeTenantId = clerkActiveTenantId ? String(clerkActiveTenantId) : null;
  if (!activeTenantId && !orgFirst) {
    activeTenantId = await resolveInitialActiveTenantId(populated._id);
    if (activeTenantId) activeTenantId = String(activeTenantId);
  }

  const needsTenantSelection = orgFirst
    ? memberships.length > 0 && !activeTenantId
    : memberships.length > 1 && !activeTenantId;

  await finishAuthSession(req, res, populated._id, activeTenantId || null);

  if (authMethod) {
    const userObj = populated.toObject ? populated.toObject() : populated;
    identifyServerUser(userObj);
    capturePostHogEvent(req, 'user_logged_in', { method: authMethod, source: 'server' });
  }

  if (authMethod === 'clerk' && populated.clerkId && populated.mustChangePassword) {
    populated.mustChangePassword = false;
    await User.updateOne(
      { _id: populated._id },
      { $set: { mustChangePassword: false } },
    ).setOptions({ bypassTenant: true });
  }

  const payload = formatAuthUser(populated);
  payload.memberships = memberships.map((m) => ({
    id: String(m._id),
    role: m.role,
    tenant: m.tenantId && typeof m.tenantId === 'object'
      ? { _id: m.tenantId._id, name: m.tenantId.name }
      : { _id: m.tenantId },
  }));
  payload.needsTenantSelection = needsTenantSelection;
  await attachActiveTenantFields(payload, activeTenantId);
  return res.json(payload);
};

const isRegistrationAllowed = (emailLower) => {
  if (process.env.REGISTRATION_DISABLED === 'true' && process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Registration is disabled. Contact an administrator.' };
  }
  if (process.env.NODE_ENV !== 'production') return { ok: true };

  const domain = emailLower.split('@')[1] || '';
  if (ALLOWED_DOMAIN && domain !== ALLOWED_DOMAIN && emailLower !== ADMIN_EMAIL) {
    return { ok: false, error: 'Registration restricted to authorized email domain' };
  }
  return { ok: true };
};

const resolveSignupDepartment = async (departmentId) => {
  if (departmentId === null || departmentId === '' || departmentId === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof departmentId !== 'string') {
    return { ok: false, error: 'Invalid department' };
  }
  const dept = await Department.findById(departmentId);
  if (!dept || !dept.signupAllowed) {
    return { ok: false, error: 'Invalid or restricted department' };
  }
  return { ok: true, value: dept._id };
};

exports.register = async (req, res) => {
  if (blockLegacyAuth(res)) return;
  try {
    const { name, email, password, gender, departmentId } = req.body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    const emailLower = email.toLowerCase().trim();

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const registrationCheck = isRegistrationAllowed(emailLower);
    if (!registrationCheck.ok) {
      return res.status(403).json({ error: registrationCheck.error });
    }

    const normalizedPassword = normalizePasswordInput(password);

    const deptCheck = await resolveSignupDepartment(departmentId);
    if (!deptCheck.ok) {
      return res.status(400).json({ error: deptCheck.error });
    }

    const userExists = await User.findOne({ email: emailLower });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const { getRandomAvatar } = require('../../../utils/avatarGenerator');
    const { name: displayName } = normalizePersonName(name);
    if (!displayName) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    const user = await User.create({
      name: displayName,
      email: emailLower,
      password: normalizedPassword,
      gender: gender || 'male',
      avatar: getRandomAvatar(gender || 'male'),
      departmentId: deptCheck.value,
      passwordChangedAt: new Date(),
    });

    const populated = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    await finishAuthSession(req, res, populated._id, await require('../../../services/tenantMembershipService').resolveInitialActiveTenantId(populated._id));
    capturePostHogEvent(req, 'user_registered', { method: 'email' });
    const authPayload = formatAuthUser(populated);
    const memberships = await require('../../../services/tenantMembershipService').listActiveMemberships(populated._id);
    authPayload.memberships = memberships.map((m) => ({
      id: String(m._id),
      role: m.role,
      tenant: m.tenantId && typeof m.tenantId === 'object'
        ? { _id: m.tenantId._id, name: m.tenantId.name }
        : { _id: m.tenantId },
    }));
    return res.status(201).json(authPayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  if (blockLegacyAuth(res)) return;
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return apiError(res, 'Invalid credentials format', 400);
    }

    const emailTrimmed = email.trim();
    let query;
    if (emailTrimmed.includes('@')) {
      query = { email: emailTrimmed.toLowerCase() };
    } else {
      const { name: normalizedName } = normalizePersonName(emailTrimmed);
      const orConditions = [{ phone: emailTrimmed }];
      if (normalizedName) orConditions.push({ name: normalizedName });
      query = { $or: orConditions };
    }

    const user = await User.findOne(query).select('+password').setOptions({ bypassTenant: true });
    let isMatch = false;
    if (user) {
      for (const candidate of passwordCandidatesForCompare(password)) {
        // eslint-disable-next-line no-await-in-loop
        if (await user.comparePassword(candidate)) {
          isMatch = true;
          break;
        }
      }
    }

    if (user && isMatch) {
      if (user.suspended) {
        clearAuthCookie(res, req);
        return apiError(res, 'Account suspended. Contact an administrator.', 403);
      }
      const userWithMfa = await User.findById(user._id)
        .select('+password +mfa.secretEncrypted +mfa.backupCodesHash')
        .setOptions({ bypassTenant: true });
      const { assertLoginAllowed } = require('../../../services/tenantSecurityService');
      const { verifyUserMfa } = require('../../../services/mfaService');
      try {
        await assertLoginAllowed({ req, user: userWithMfa, authMethod: 'email_password' });
      } catch (err) {
        return apiError(res, err.message, err.status || 403);
      }
      if (userWithMfa.mfa?.enabled) {
        const { mfaToken } = req.body;
        if (!mfaToken) {
          return res.status(200).json({ mfaRequired: true, email: user.email });
        }
        if (!verifyUserMfa(userWithMfa, mfaToken)) {
          return apiError(res, 'Invalid MFA code', 401);
        }
      }
      const stillOnDefaultPassword = await user.comparePassword(getDefaultSeedPassword());
      const seededWithoutPasswordChange = user.mustChangePassword === false;
      const shouldFlagDefaultPassword = stillOnDefaultPassword
        && !seededWithoutPasswordChange
        && !isE2eTestUser(user.email);
      if (shouldFlagDefaultPassword) {
        user.mustChangePassword = true;
        await user.save();
      }

      const populated = await User.findById(user._id)
        .select('-password')
        .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');
      return sendAuthSuccess(req, res, populated, { authMethod: 'email_password' });
    }

    if (user && user.googleId && !isMatch && !user.password) {
      return apiError(
        res,
        'No email password set yet. Sign in with Google, set a password in Profile settings, or use Forgot password.',
        401,
      );
    }

    return apiError(res, 'Invalid email or password', 401);
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

exports.googleLogin = async (req, res) => {
  if (blockLegacyAuth(res)) return;
  try {
    const { tokenId } = req.body;
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { name, email, picture } = ticket.getPayload();
    const emailLower = email.toLowerCase().trim();

    const registrationCheck = isRegistrationAllowed(emailLower);
    if (!registrationCheck.ok) {
      return res.status(403).json({ error: registrationCheck.error });
    }

    let user = await User.findOne({ email: emailLower });

    if (!user) {
      user = await User.create({
        name,
        email: emailLower,
        password: Math.random().toString(36).slice(-8),
        avatar: picture,
      });
    }
    if (user.suspended) {
      clearAuthCookie(res, req);
      return res.status(403).json({ error: 'Account suspended. Contact an administrator.' });
    }

    const populated = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    return sendAuthSuccess(req, res, populated, { authMethod: 'google_token' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const { getTokenFromRequest } = require('../../../utils/authCookie');
    const { verifySessionToken } = require('../../../utils/authSession');
    const { revokeToken } = require('../../../utils/tokenRevocation');
    const token = getTokenFromRequest(req);
    if (token) {
      try {
        const decoded = verifySessionToken(token);
        if (!decoded.purpose) {
          await revokeToken(decoded);
          if (decoded.jti) await removeSession(decoded.id, decoded.jti);
        }
      } catch {
        /* ignore invalid token on logout */
      }
    }
  } catch {
    /* revocation is best-effort */
  }
  clearAuthCookie(res, req);
  capturePostHogEvent(req, 'user_logged_out');
  res.json({ success: true, hadCookie: hadAuthCookie(req) });
};

exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return apiError(res, 'Not authorized', 401);
    }
    if (req.user.departmentId && !req.user.departmentId.slug) {
      const { DEPARTMENT_POPULATE } = require('../../../utils/authUserLookup');
      await req.user.populate('departmentId', DEPARTMENT_POPULATE);
    }
    const {
      listActiveMemberships,
      formatMembershipRow,
    } = require('../../../services/tenantMembershipService');
    const { getTokenFromRequest } = require('../../../utils/authCookie');
    const { verifySessionToken } = require('../../../utils/authSession');
    const memberships = await listActiveMemberships(req.user._id);
    let activeTenantId = req.tenantId || null;
    try {
      const token = getTokenFromRequest(req);
      if (token) {
        const decoded = verifySessionToken(token);
        activeTenantId = decoded.activeTenantId || activeTenantId;
      }
    } catch {
      /* ignore */
    }
    const payload = attachProfileCompletion(req.user);
    payload.memberships = memberships.map(formatMembershipRow);
    await attachActiveTenantFields(payload, activeTenantId);
    const orgFirst = require('../../../utils/orgFirstAuth').isOrgFirstAuthEnabled();
    payload.needsTenantSelection = orgFirst
      ? memberships.length > 0 && !activeTenantId
      : memberships.length > 1 && !activeTenantId;
    return res.json(payload);
  } catch (error) {
    logger.error('authController', 'getMe failed', { error: error.message || error });
    return apiError(res, 'Failed to load user profile', 500);
  }
};

/** Public auth deploy self-check — no secrets. */
exports.getAuthConfig = (req, res) => {
  const pk = String(process.env.CLERK_PUBLISHABLE_KEY || '').trim();
  const publishableKeyPrefix = pk.length >= 12 ? pk.slice(0, 12) : pk || null;
  return res.json({
    clerkConfigured: isClerkConfigured(),
    publishableKeyPrefix,
    orgFirstAuth: require('../../../utils/orgFirstAuth').isOrgFirstAuthEnabled(),
    apiGitSha: String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').slice(0, 7) || 'unknown',
    cookieDomain: process.env.COOKIE_DOMAIN || '.tsccoreknot.com',
  });
};

/** Silent session bootstrap — 200 with authenticated:false when logged out (no 401 noise in DevTools). */
exports.getSession = async (req, res) => {
  try {
    if (req.sessionSuspended) {
      clearAuthCookie(res, req);
      return res.status(403).json({
        authenticated: false,
        error: 'Account suspended. Contact an administrator.',
      });
    }
    if (!req.user) {
      return res.json({ authenticated: false });
    }
    if (req.user.departmentId && !req.user.departmentId.slug) {
      const { DEPARTMENT_POPULATE } = require('../../../utils/authUserLookup');
      await req.user.populate('departmentId', DEPARTMENT_POPULATE);
    }
    let activeTenantId = req.tenantId || null;
    try {
      const token = getTokenFromRequest(req);
      if (token) {
        const decoded = verifySessionToken(token);
        activeTenantId = decoded.activeTenantId || activeTenantId;
      }
    } catch {
      /* ignore */
    }
    const payload = attachProfileCompletion(req.user);
    await attachActiveTenantFields(payload, activeTenantId);
    return res.json({
      authenticated: true,
      user: payload,
    });
  } catch (error) {
    logger.error('authController', 'getSession failed', { error: error.message || error });
    return apiError(res, 'Failed to load session', 500);
  }
};

/** Short-lived scoped JWT for Socket.io — not the session cookie value. */
exports.getRealtimeToken = (req, res) => {
  const secret = process.env.SOCKET_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return apiError(res, 'Realtime auth not configured', 503);
  }
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { id: req.user._id.toString(), scope: 'realtime', jti },
    secret,
    { expiresIn: '5m' },
  );
  return res.json({ token });
};

exports.changeRequiredPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid input format' });
    }
    const normalizedNewPassword = normalizePasswordInput(newPassword);
    const normalizedConfirm = normalizePasswordInput(confirmPassword);
    if (normalizedNewPassword !== normalizedConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const passwordError = validatePasswordStrength(normalizedNewPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await User.findById(req.user._id).select('+password').setOptions({ bypassTenant: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.mustChangePassword) {
      return res.status(400).json({ error: 'Password change is not required for this account' });
    }

    user.password = normalizedNewPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    const verified = await User.findById(user._id).select('+password').setOptions({ bypassTenant: true });
    const passwordSaved = verified ? await verified.comparePassword(normalizedNewPassword) : false;

    if (!passwordSaved) {
      logger.error('Auth', 'changeRequiredPassword verification failed', { userId: user._id });
      return res.status(500).json({ error: 'Password could not be saved. Please try again.' });
    }

    if (user.clerkId) {
      try {
        await syncClerkUserPassword(user.clerkId, normalizedNewPassword);
      } catch (clerkErr) {
        logger.error('Auth', 'changeRequiredPassword Clerk password sync failed', {
          userId: user._id,
          error: clerkErr.message,
        });
        return res.status(clerkErr.status || 502).json({
          error: clerkErr.message || 'Password saved locally but Clerk sync failed. Try again.',
        });
      }
    }

    const { revokeSessionsOnPasswordChange } = require('../../../utils/passwordSessionRevoke');
    await revokeSessionsOnPasswordChange(req, user._id);

    const populated = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    return res.json(formatAuthUser(populated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.googleAuthRedirect = (req, res) => {
  if (isClerkProductionAuth()) {
    return res.redirect(`${resolveAuthFrontendUrl()}/login`);
  }
  if (req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('axios')) {
    return res.status(401).json({ error: 'Unauthorized API access' });
  }
  const { state } = req.query;
  const redirectUri = resolveGoogleRedirectUri(req);
  const client = createOAuth2Client(redirectUri);
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/webmasters.readonly',
  ];

  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: state || 'login',
  });

  res.redirect(url);
};

exports.googleAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const redirectUri = resolveGoogleRedirectUri(req);
    const callbackClient = createOAuth2Client(redirectUri);
    const { tokens } = await callbackClient.getToken(code);
    callbackClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: callbackClient });
    const { data: profile } = await oauth2.userinfo.get();

    const email = profile.email;
    const emailLower = email.toLowerCase().trim();
    const domain = emailLower.split('@')[1];

    if (state && state.startsWith('link_')) {
      const userId = state.split('_')[1];
      const user = await User.findById(userId);
      if (user) {
        const exists = user.googleAccounts.some((acc) => acc.email.toLowerCase() === emailLower);
        if (!exists) {
          user.googleAccounts.push({
            email: emailLower,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
        }
        if (tokens.refresh_token) {
          user.googleRefreshToken = tokens.refresh_token;
        }
        if (tokens.access_token) {
          user.googleAccessToken = tokens.access_token;
        }
        user.googleCalendarLinked = true;
        await user.save();
      }
      return res.redirect(`${resolveAuthFrontendUrl()}/auth/google/success?link=success`);
    }

    if (isClerkProductionAuth()) {
      return res.redirect(`${resolveAuthFrontendUrl()}/login`);
    }

    if (process.env.NODE_ENV === 'production' && emailLower !== ADMIN_EMAIL && domain !== ALLOWED_DOMAIN && state !== 'connect') {
      return res.redirect(`${resolveAuthFrontendUrl()}/login?error=unauthorized_domain`);
    }

    let user = await User.findOne({ email: emailLower });

    if (!user) {
      user = await User.create({
        name: profile.name,
        email: emailLower,
        avatar: profile.picture,
        googleId: profile.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleCalendarLinked: true,
      });
    } else {
      user.googleId = profile.id;
      user.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
      }
      user.googleCalendarLinked = true;
      await user.save();
    }

    const ticket = generateOAuthTicket(user._id);

    res.redirect(`${resolveAuthFrontendUrl()}/auth/google/success?ticket=${encodeURIComponent(ticket)}`);
  } catch (error) {
    logger.error('authController', 'Google Auth ', { error: error.message || error });
    res.redirect(`${resolveAuthFrontendUrl()}/login?error=auth_failed`);
  }
};

exports.oauthEstablishSession = async (req, res) => {
  if (blockLegacyAuth(res)) return;
  try {
    const { ticket } = req.body;
    if (typeof ticket !== 'string' || !ticket.trim()) {
      return res.status(400).json({ error: 'Missing OAuth ticket' });
    }

    const userId = verifyOAuthTicket(ticket.trim());
    const populated = await User.findById(userId)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    if (!populated) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    if (populated.suspended) {
      clearAuthCookie(res, req);
      return res.status(403).json({ error: 'Account suspended. Contact an administrator.' });
    }

    await finishAuthSession(req, res, populated._id);
    capturePostHogEvent(req, 'user_logged_in', { method: 'google_oauth' });
    return res.json(formatAuthUser(populated));
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired OAuth ticket' });
  }
};

const clerkEstablishSessionHandler = async (req, res) => {
  if (!isClerkConfigured()) {
    return res.status(503).json({ error: 'Clerk authentication is not configured' });
  }
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      return res.status(400).json({ error: 'Missing Clerk session token' });
    }

    const profile = await verifyClerkSessionToken(token);
    if (!profile) {
      const mismatch = clerkTokenInstanceMismatchMessage(token);
      return res.status(401).json({
        error: mismatch || 'Invalid Clerk session',
      });
    }

    assertEstablishAllowed(profile);

    const clerkOrganizationId = resolveClerkOrganizationId({
      bodyOrganizationId: req.body?.organizationId,
      tokenOrganizationId: profile.clerkOrganizationId,
    });
    const tenant = await resolveTenantForOrganization(clerkOrganizationId);

    if (require('../../../utils/orgFirstAuth').isOrgFirstAuthEnabled()) {
      if (!clerkOrganizationId) {
        return res.status(400).json({
          error: 'Organization selection required',
          code: 'NEEDS_ORGANIZATION_SELECTION',
        });
      }
      if (!tenant) {
        return res.status(403).json({
          error: 'No workspace found for this organization. Contact your administrator.',
        });
      }
    }

    if (shouldEnforceClerkOrganization() && clerkOrganizationId) {
      await ensureClerkOrganizationAccess({
        clerkClient,
        clerkUserId: profile.clerkUserId,
        email: profile.email,
        clerkOrganizationId,
        tenant,
      });
    }

    const populated = await resolveUserFromClerkProfile(profile, {
      tenantId: tenant?._id,
    });
    if (!populated) {
      return res.status(403).json({
        error: 'No CoreKnot account found for this email. Ask your organisation admin to add you first.',
      });
    }
    if (populated.suspended) {
      clearAuthCookie(res, req);
      return res.status(403).json({ error: 'Account suspended. Contact an administrator.' });
    }

    return await sendAuthSuccess(req, res, populated, {
      authMethod: 'clerk',
      clerkActiveTenantId: tenant?._id,
    });
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid Clerk session' });
    }
    let status = error.status;
    if (!status) {
      status = error.name === 'ValidationError' ? 400 : 500;
    }
    if (status >= 500) {
      logger.error('authController', 'clerkEstablishSession', { error: error.message || error });
    }
    return res.status(status).json({ error: error.message || 'Clerk sign-in failed' });
  }
};

exports.clerkEstablishSession = asyncHandler(clerkEstablishSessionHandler);

const currentSessionDecoded = (req) => {
  const token = getSessionCookie(req);
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
};

const resolveSessionDecoded = (req, res) => {
  let decoded = currentSessionDecoded(req);
  if (!decoded?.id) return null;
  if (!decoded.jti) {
    const token = generateSessionToken(decoded.id, resolveLoginAt(decoded));
    setAuthCookie(res, token, req);
    decoded = verifySessionToken(token);
  }
  return decoded;
};

exports.listSessions = async (req, res) => {
  try {
    const decoded = resolveSessionDecoded(req, res);
    if (!decoded?.jti || !decoded.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    await ensureSession(req, decoded.id, decoded);
    const sessions = await listUserSessions(decoded.id, decoded.jti);
    return res.json({ sessions });
  } catch (error) {
    logger.error('authController', 'listSessions failed', { error: error.message || error });
    return res.status(500).json({ error: 'Failed to load sessions' });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const decoded = currentSessionDecoded(req);
    if (!decoded?.jti || !decoded.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    const targetJti = req.params.jti;
    if (!targetJti) {
      return res.status(400).json({ error: 'Missing session id' });
    }
    const sessions = await listUserSessions(decoded.id);
    const target = sessions.find((s) => s.jti === targetJti);
    if (!target) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { revokeToken } = require('../../../utils/tokenRevocation');
    await revokeToken({ jti: targetJti, exp: decoded.exp });
    await removeSession(decoded.id, targetJti);

    const isCurrent = targetJti === decoded.jti;
    if (isCurrent) clearAuthCookie(res, req);
    return res.json({ success: true, revokedCurrent: isCurrent });
  } catch (error) {
    logger.error('authController', 'revokeSession failed', { error: error.message || error });
    return res.status(500).json({ error: 'Failed to revoke session' });
  }
};

exports.revokeOtherSessions = async (req, res) => {
  try {
    const decoded = currentSessionDecoded(req);
    if (!decoded?.jti || !decoded.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    const { revokeOtherUserSessions } = require('../../../utils/sessionRegistry');
    const { revoked } = await revokeOtherUserSessions(decoded.id, decoded.jti);
    return res.json({ success: true, revoked });
  } catch (error) {
    logger.error('authController', 'revokeOtherSessions failed', { error: error.message || error });
    return res.status(500).json({ error: 'Failed to revoke sessions' });
  }
};

/** Admin: revoke all sessions for any user (compromised org / offboarding). */
exports.adminRevokeAllUserSessions = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!targetId) return res.status(400).json({ error: 'Missing user id' });

    const targetUser = await User.findById(targetId).select('_id suspended');
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const { revokeAllUserSessions } = require('../../../utils/sessionRegistry');
    const { revoked } = await revokeAllUserSessions(targetId.toString());

    const isSelf = req.user._id.toString() === targetId.toString();
    if (isSelf) clearAuthCookie(res, req);

    logger.info('authController', 'adminRevokeAllUserSessions', {
      actorId: req.user._id.toString(),
      targetId: targetId.toString(),
      revoked,
    });

    return res.json({ success: true, revoked });
  } catch (error) {
    logger.error('authController', 'adminRevokeAllUserSessions failed', { error: error.message || error });
    return res.status(500).json({ error: 'Failed to revoke user sessions' });
  }
};

const buildAccessRequestEmailHtml = ({ requesterName, requesterEmail, note, adminUsersUrl }) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="color: #0d9488; margin-bottom: 8px;">CoreKnot access request</h2>
    <p>Someone asked to join your organisation workspace.</p>
    <p><strong>Name:</strong> ${requesterName || 'Not provided'}</p>
    <p><strong>Email:</strong> ${requesterEmail}</p>
    ${note ? `<p><strong>Message:</strong> ${note}</p>` : ''}
    <p style="text-align: center; margin: 28px 0;">
      <a href="${adminUsersUrl}" style="background: #0d9488; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; display: inline-block;">
        Open Admin → Users
      </a>
    </p>
    <p style="font-size: 13px; color: #666;">Add them in CoreKnot, then share the temporary password shown once after creation.</p>
  </div>
`;

exports.requestAccess = async (req, res) => {
  try {
    const { email, name, message } = req.body;
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailLower = email.toLowerCase().trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailLower)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existing = await User.findOne({ email: emailLower }).setOptions({ bypassTenant: true });
    if (existing) {
      return res.status(409).json({
        error: 'An account with this email already exists. Sign in or ask your admin for credentials.',
      });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!adminEmail) {
      logger.warn('authController', 'requestAccess without ADMIN_EMAIL');
      return res.status(503).json({ error: 'Access requests are not configured. Contact support.' });
    }

    const { resolveClientUrl } = require('../../../utils/oauthEnv');
    const adminUsersUrl = `${resolveClientUrl()}/admin/users`;
    const requesterName = typeof name === 'string' ? name.trim() : '';
    const note = typeof message === 'string' ? message.trim() : '';

    try {
      await sendSystemEmail({
        to: adminEmail,
        subject: `CoreKnot access request — ${emailLower}`,
        html: buildAccessRequestEmailHtml({
          requesterName,
          requesterEmail: emailLower,
          note,
          adminUsersUrl,
        }),
        text: [
          'CoreKnot access request',
          `Name: ${requesterName || 'Not provided'}`,
          `Email: ${emailLower}`,
          note ? `Message: ${note}` : '',
          `Add user: ${adminUsersUrl}`,
        ].filter(Boolean).join('\n'),
      });
    } catch (mailErr) {
      logger.error('authController', 'requestAccess email failed', {
        error: mailErr.message,
        email: emailLower,
      });
      return res.status(500).json({ error: 'Could not send access request. Please try again later.' });
    }

    return res.json({
      message: 'Request sent. Your organisation admin will add you and share login credentials.',
    });
  } catch (error) {
    logger.error('authController', 'requestAccess failed', { error: error.message || error });
    return res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  if (blockLegacyAuth(res)) return;
  try {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const emailLower = email.toLowerCase().trim();
    const genericMessage = 'If an account exists with that email, password reset instructions have been sent.';

    const user = await User.findOne({ email: emailLower })
      .select('+passwordResetToken +passwordResetExpires')
      .setOptions({ bypassTenant: true });

    if (!user) {
      return res.json({ message: genericMessage });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashResetToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await user.save();

    const resetUrl = `${resolveAuthFrontendUrl()}/reset-password?token=${resetToken}`;

    const { resolvePasswordResetCcEmails } = require('../../../utils/platformNotificationRecipients');
    const ccList = await resolvePasswordResetCcEmails();
    const cc = ccList.length ? ccList.join(', ') : PASSWORD_RESET_CC;

    try {
      await sendSystemEmail({
        to: user.email,
        cc,
        subject: 'Reset your Coreknot password',
        html: buildPasswordResetEmailHtml({ name: user.name, resetUrl }),
        text: `Reset your Coreknot password: ${resetUrl}`,
      });
    } catch (mailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      logger.error('authController', 'forgotPassword email failed', { error: mailErr.message, email: emailLower });
      return res.status(500).json({ error: 'Could not send reset email. Please try again later.' });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    logger.error('authController', 'forgotPassword failed', { error: error.message || error });
    return res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  if (blockLegacyAuth(res)) return;
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }
    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid input format' });
    }
    const normalizedNewPassword = normalizePasswordInput(newPassword);
    const normalizedConfirm = normalizePasswordInput(confirmPassword);
    if (normalizedNewPassword !== normalizedConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const passwordError = validatePasswordStrength(normalizedNewPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashedToken = hashResetToken(token.trim());
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    })
      .select('+password +passwordResetToken +passwordResetExpires')
      .setOptions({ bypassTenant: true });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    user.password = normalizedNewPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    if (user.clerkId) {
      try {
        await syncClerkUserPassword(user.clerkId, normalizedNewPassword);
      } catch (clerkErr) {
        logger.error('authController', 'resetPassword Clerk password sync failed', {
          userId: user._id,
          error: clerkErr.message,
        });
        return res.status(clerkErr.status || 502).json({
          error: clerkErr.message || 'Password saved locally but Clerk sync failed. Try again.',
        });
      }
    }

    const { revokeAllUserSessions } = require('../../../utils/sessionRegistry');
    await revokeAllUserSessions(user._id.toString());

    return res.json({ message: 'Password updated successfully. You can now sign in with your new password.' });
  } catch (error) {
    logger.error('authController', 'resetPassword failed', { error: error.message || error });
    return res.status(500).json({ error: error.message });
  }
};

exports.mfaSetup = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).setOptions({ bypassTenant: true });
    if (!user) return apiError(res, 'User not found', 404);
    const { startMfaEnrollment } = require('../../../services/mfaService');
    const { secret, otpauthUrl } = startMfaEnrollment(user);
    await user.save();
    return res.json({ secret, otpauthUrl });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

exports.mfaConfirm = async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return apiError(res, 'token required', 400);
    const user = await User.findById(req.user._id)
      .select('+mfa.pendingSecretEncrypted +mfa.secretEncrypted +mfa.backupCodesHash')
      .setOptions({ bypassTenant: true });
    if (!user) return apiError(res, 'User not found', 404);
    const { confirmMfaEnrollment } = require('../../../services/mfaService');
    const backupCodes = confirmMfaEnrollment(user, token);
    if (!backupCodes) return apiError(res, 'Invalid MFA code', 400);
    await user.save();
    return res.json({ enabled: true, backupCodes });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

exports.mfaDisable = async (req, res) => {
  try {
    const { token } = req.body || {};
    const user = await User.findById(req.user._id)
      .select('+mfa.secretEncrypted +mfa.backupCodesHash +mfa.pendingSecretEncrypted')
      .setOptions({ bypassTenant: true });
    if (!user) return apiError(res, 'User not found', 404);
    const { verifyUserMfa } = require('../../../services/mfaService');
    if (!user.mfa?.enabled || !verifyUserMfa(user, token)) {
      return apiError(res, 'Valid MFA code required to disable', 400);
    }
    user.mfa = { enabled: false };
    await user.save();
    return res.json({ enabled: false });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};
