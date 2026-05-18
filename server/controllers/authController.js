const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || '').trim();

exports.register = async (req, res) => {
  try {
    const { name, email, password, gender } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const { getRandomAvatar } = require('../utils/avatarGenerator');
    const user = await User.create({ 
      name, 
      email, 
      password, 
      gender: gender || 'male',
      avatar: getRandomAvatar(gender || 'male')
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      gender: user.gender,
      avatar: user.avatar,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body; 
    const query = email.includes('@') 
      ? { email: email.toLowerCase() } 
      : { $or: [{ phone: email }, { name: email }] };

    const user = await User.findOne(query);

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { tokenId } = req.body;
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const { name, email, picture } = ticket.getPayload();

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new user if not exists
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(-8), // Random password
        avatar: picture,
        role: 'operative' // Default role
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};

exports.googleAuthRedirect = (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });

  res.redirect(url);
};

exports.googleAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const { createOAuth2Client } = require('../utils/googleAuth');
    const callbackClient = createOAuth2Client();
    const { tokens } = await callbackClient.getToken(code);
    callbackClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: callbackClient });
    const { data: profile } = await oauth2.userinfo.get();

    const email = profile.email;
    const domain = email.split('@')[1];

    if (process.env.NODE_ENV === 'production' && email !== ADMIN_EMAIL && domain !== ALLOWED_DOMAIN && req.query.state !== 'connect') {
      return res.redirect(`${FRONTEND_URL}/login?error=unauthorized_domain`);
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name: profile.name,
        email: email.toLowerCase(),
        avatar: profile.picture,
        googleId: profile.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleCalendarLinked: true // Auto-link if they sign in via Google
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
    const userJson = JSON.stringify({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    });

    res.redirect(`${FRONTEND_URL}/auth/google/success?token=${token}&user=${encodeURIComponent(userJson)}`);
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
};
