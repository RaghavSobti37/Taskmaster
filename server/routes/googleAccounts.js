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

// Simulate linking an account (instant email input)
router.post('/simulate', async (req, res) => {
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
    const exists = user.googleAccounts.some(acc => acc.email.toLowerCase() === emailLower);
    if (exists) {
      return res.status(400).json({ error: 'This email is already linked.' });
    }

    // Create a mock token for development simulation
    const simulatedAccount = {
      email: emailLower,
      accessToken: 'simulated_access_token_' + Math.random().toString(36).substring(7),
      refreshToken: 'simulated_refresh_token_' + Math.random().toString(36).substring(7)
    };

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
