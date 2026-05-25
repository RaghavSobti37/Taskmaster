const jwt = require('jsonwebtoken');
const { verifyToken, clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const isBypassEnabled = process.env.NODE_ENV === 'development' 
      && String(process.env.DEBUG_BYPASS).trim() === 'true';
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    const bypassToken = process.env.DEBUG_BYPASS_TOKEN || 'bypass_token';
    if (isBypassEnabled && isLocalhost && token === bypassToken) {
      const adminUser = await User.findOne({ role: 'admin' }).select('-password');
      if (adminUser) {
        req.user = adminUser;
      } else {
        return res.status(503).json({ error: 'No admin user available for bypass' });
      }
      return next();
    }

    let userId = null;
    let email = null;

    // Dual Authentication Pipeline: Attempt Clerk Verification First
    if (process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'mock_clerk_secret') {
      try {
        const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
        if (verified && verified.sub) {
          const clerkUser = await clerkClient.users.getUser(verified.sub);
          email = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();
        }
      } catch (clerkErr) {
        // Fallthrough to standard JWT if Clerk verification fails (e.g., standard login token)
      }
    }

    if (email) {
      // Find or synchronize user with database
      let dbUser = await User.findOne({ email });
      if (!dbUser) {
        dbUser = await User.create({
          name: email.split('@')[0],
          email: email,
          password: process.env.DEFAULT_SEED_PASSWORD || (Math.random().toString(36).substring(2) + Date.now().toString(36)),
          role: 'user',
        });
      }
      req.user = dbUser;
    } else {
      // Standard JWT Verification
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    }

    if (!req.user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Update presence
    await User.findByIdAndUpdate(req.user._id, { 
      $set: { lastOnline: new Date(), online: true } 
    });
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };
