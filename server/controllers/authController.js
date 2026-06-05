const User = require('../models/User');
const Department = require('../models/Department');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { google } = require('googleapis');
const logger = require('../utils/logger');
const { clearAuthCookie, hadAuthCookie } = require('../utils/authCookie');
const { establishSession } = require('../utils/authSession');
const { createOAuth2Client, resolveGoogleRedirectUri } = require('../utils/googleAuth');
const { validatePasswordStrength } = require('../utils/passwordValidation');
const { normalizePasswordInput, passwordCandidatesForCompare } = require('../utils/passwordAuth');
const { normalizePersonName } = require('../utils/sanitizer');
const { attachProfileCompletion } = require('../utils/profileCompleteness');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
const { sendSystemEmail } = require('../utils/sendSystemEmail');

const oauth2Client = createOAuth2Client(resolveGoogleRedirectUri());

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

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
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

const sendAuthSuccess = (res, populated) => {
  establishSession(res, populated._id);
  return res.json(formatAuthUser(populated));
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

    const { getRandomAvatar } = require('../utils/avatarGenerator');
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

    establishSession(res, populated._id);
    return res.status(201).json(formatAuthUser(populated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid credentials format' });
    }

    const emailTrimmed = email.trim();
    const query = emailTrimmed.includes('@')
      ? { email: emailTrimmed.toLowerCase() }
      : { $or: [{ phone: emailTrimmed }, { name: emailTrimmed }] };

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
      const stillOnDefaultPassword = await user.comparePassword(getDefaultSeedPassword());
      if (stillOnDefaultPassword && !user.mustChangePassword) {
        user.mustChangePassword = true;
        await user.save();
      }

      const populated = await User.findById(user._id)
        .select('-password')
        .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');
      establishSession(res, populated._id);
      return res.json(formatAuthUser(populated));
    }

    if (user && user.googleId && !isMatch && !user.password) {
      return res.status(401).json({
        error: 'No email password set yet. Sign in with Google, set a password in Profile settings, or use Forgot password.',
      });
    }

    res.status(401).json({ error: 'Invalid email or password' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
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

    const populated = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    return sendAuthSuccess(res, populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, hadCookie: hadAuthCookie(req) });
};

exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    return res.json(attachProfileCompletion(req.user));
  } catch (error) {
    logger.error('authController', 'getMe failed', { error: error.message || error });
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
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

    const populated = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    return res.json(formatAuthUser(populated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.googleAuthRedirect = (req, res) => {
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
          await user.save();
        }
      }
      return res.redirect(`${FRONTEND_URL}/auth/google/success?link=success`);
    }

    if (process.env.NODE_ENV === 'production' && emailLower !== ADMIN_EMAIL && domain !== ALLOWED_DOMAIN && state !== 'connect') {
      return res.redirect(`${FRONTEND_URL}/login?error=unauthorized_domain`);
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

    res.redirect(`${FRONTEND_URL}/auth/google/success?ticket=${encodeURIComponent(ticket)}`);
  } catch (error) {
    logger.error('authController', 'Google Auth ', { error: error.message || error });
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
};

exports.oauthEstablishSession = async (req, res) => {
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

    establishSession(res, populated._id);
    return res.json(formatAuthUser(populated));
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired OAuth ticket' });
  }
};

exports.forgotPassword = async (req, res) => {
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

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      await sendSystemEmail({
        to: user.email,
        cc: PASSWORD_RESET_CC,
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

    return res.json({ message: 'Password updated successfully. You can now sign in with your new password.' });
  } catch (error) {
    logger.error('authController', 'resetPassword failed', { error: error.message || error });
    return res.status(500).json({ error: error.message });
  }
};
