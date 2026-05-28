const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Get all connected accounts
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('googleAccounts');
    res.json(user.googleAccounts || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initiate Google OAuth flow for account linking
router.post('/link-oauth', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid Google email address' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const emailLower = email.toLowerCase().trim();
    const exists = user.googleAccounts?.some(acc => acc.email.toLowerCase() === emailLower);
    if (exists) {
      return res.status(400).json({ error: 'This email is already linked.' });
    }

    // Generate OAuth consent screen URL
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.SERVER_URL || 'http://localhost:5000'}/api/google/accounts/callback`
    );

    // Store linking context in session/state
    const state = Buffer.from(JSON.stringify({
      userId: req.user._id,
      email: emailLower,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.readonly'
      ],
      state: state,
      login_hint: emailLower,
      prompt: 'consent'
    });

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Google OAuth linking error:', error);
    res.status(500).json({ error: 'Failed to initiate Google linking: ' + error.message });
  }
});

// Handle OAuth callback for account linking
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Decode state to get user context
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId, email: expectedEmail } = stateData;

    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'User mismatch in OAuth flow' });
    }

    // Exchange code for tokens
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.SERVER_URL || 'http://localhost:5000'}/api/google/accounts/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Verify the email matches
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    if (userInfo.data.email.toLowerCase() !== expectedEmail.toLowerCase()) {
      return res.status(400).json({ error: `Email mismatch. Expected ${expectedEmail}, got ${userInfo.data.email}` });
    }

    // Save linked account
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const linkedAccount = {
      email: userInfo.data.email,
      name: userInfo.data.name || '',
      picture: userInfo.data.picture || '',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresIn: tokens.expiry_date,
      linkedAt: new Date()
    };

    user.googleAccounts = user.googleAccounts || [];
    user.googleAccounts.push(linkedAccount);
    await user.save();

    res.json({ 
      message: 'Google account linked successfully',
      account: linkedAccount 
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to link Google account: ' + error.message });
  }
});

// Manual email linking (save typed emails without full OAuth)
router.post('/manual', async (req, res) => {
  try {
    const raw = req.body?.emails ?? req.body?.email ?? '';
    const emails = (Array.isArray(raw) ? raw : String(raw).split(/[\n,;]+/))
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));

    if (!emails.length) {
      return res.status(400).json({ error: 'Please provide at least one valid email address' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.googleAccounts = user.googleAccounts || [];
    const added = [];

    for (const emailLower of emails) {
      const exists = user.googleAccounts.some((acc) => acc.email?.toLowerCase() === emailLower);
      if (exists) continue;
      const account = {
        email: emailLower,
        name: emailLower.split('@')[0],
        linkedAt: new Date(),
        manualLink: true,
      };
      user.googleAccounts.push(account);
      added.push(account);
    }

    if (!added.length) {
      return res.status(400).json({ error: 'All provided emails are already linked.' });
    }

    await user.save();
    res.status(201).json({ added, accounts: user.googleAccounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulate linking an account (instant email input)
router.post('/simulate', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Simulation endpoint is disabled in production.' });
  }
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid Google email address' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const emailLower = email.toLowerCase().trim();
    const exists = user.googleAccounts?.some(acc => acc.email.toLowerCase() === emailLower);
    if (exists) {
      return res.status(400).json({ error: 'This email is already linked.' });
    }

    // Create a mock token for development simulation
    const simulatedAccount = {
      email: emailLower,
      accessToken: ['simulated', 'access', 'token', Math.random().toString(36).substring(7)].join('_'),
      refreshToken: ['simulated', 'refresh', 'token', Math.random().toString(36).substring(7)].join('_')
    };

    user.googleAccounts = user.googleAccounts || [];
    user.googleAccounts.push(simulatedAccount);
    await user.save();

    res.status(201).json(user.googleAccounts[user.googleAccounts.length - 1]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unlink / delete a connected account
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.googleAccounts = user.googleAccounts.filter(acc => acc._id.toString() !== req.params.id);
    await user.save();

    res.json({ message: 'Account unlinked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
