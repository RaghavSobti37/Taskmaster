const User = require('../models/User');
const Department = require('../models/Department');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const logger = require('../utils/logger');
const { setAuthCookie, clearAuthCookie } = require('../utils/authCookie');
const { validatePasswordStrength } = require('../utils/passwordValidation');
const { attachProfileCompletion } = require('../utils/profileCompleteness');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
});

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();

const formatAuthUser = (populated) => attachProfileCompletion(
  populated.toObject ? populated.toObject() : populated
);

const sendAuthSuccess = (res, populated) => {
  const token = generateToken(populated._id);
  setAuthCookie(res, token);
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
    const registrationCheck = isRegistrationAllowed(emailLower);
    if (!registrationCheck.ok) {
      return res.status(403).json({ error: registrationCheck.error });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const deptCheck = await resolveSignupDepartment(departmentId);
    if (!deptCheck.ok) {
      return res.status(400).json({ error: deptCheck.error });
    }

    const userExists = await User.findOne({ email: emailLower });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const { getRandomAvatar } = require('../utils/avatarGenerator');
    const user = await User.create({
      name: name.trim(),
      email: emailLower,
      password,
      gender: gender || 'male',
      avatar: getRandomAvatar(gender || 'male'),
      departmentId: deptCheck.value,
    });

    const populated = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

    setAuthCookie(res, generateToken(populated._id));
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

    const user = await User.findOne(query).select('+password');
    let isMatch = false;
    if (user) {
      isMatch = await user.comparePassword(password);
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
      setAuthCookie(res, generateToken(populated._id));
      return res.json(formatAuthUser(populated));
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

exports.logout = (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');
  const payload = attachProfileCompletion(user);
  res.json(payload);
};

exports.changeRequiredPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid input format' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const passwordError = validatePasswordStrength(newPassword);
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

    user.password = newPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    const verified = await User.findById(user._id).select('+password').setOptions({ bypassTenant: true });
    const passwordSaved = verified ? await verified.comparePassword(newPassword) : false;

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
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/webmasters.readonly',
  ];

  const url = oauth2Client.generateAuthUrl({
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
    const { createOAuth2Client } = require('../utils/googleAuth');
    const callbackClient = createOAuth2Client();
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

    const token = generateToken(user._id);
    setAuthCookie(res, token);

    const freshUser = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');
    const userJson = JSON.stringify(formatAuthUser(freshUser));

    res.redirect(`${FRONTEND_URL}/auth/google/success?user=${encodeURIComponent(userJson)}`);
  } catch (error) {
    logger.error('authController', 'Google Auth ', { error: error.message || error });
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
};
