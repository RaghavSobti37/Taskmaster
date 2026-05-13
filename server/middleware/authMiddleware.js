const jwt = require('jsonwebtoken');
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
    // SECURITY: Debug bypass only in development AND only from localhost
    const isBypassEnabled = process.env.NODE_ENV === 'development' 
      && String(process.env.DEBUG_BYPASS).trim() === 'true';
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    
    if (isBypassEnabled && isLocalhost && token === 'bypass_token') {
      const adminUser = await User.findOne({ role: 'admin' }).select('-password');
      if (adminUser) {
        req.user = adminUser;
      } else {
        return res.status(503).json({ error: 'No admin user available for bypass' });
      }
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
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
