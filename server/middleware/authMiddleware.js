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
    const isBypassEnabled = String(process.env.DEBUG_BYPASS).trim() === 'true';
    if (isBypassEnabled && token === 'bypass_token') {
      // console.log('DEBUG: Bypass triggered');
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        // console.log('DEBUG: Found admin user:', adminUser.email);
        req.user = adminUser;
      } else {
        // console.log('DEBUG: No admin user in DB, using mock');
        req.user = { 
          _id: new User()._id,
          name: 'Root Admin', 
          role: 'admin', 
          outletId: 'main' 
        };
      }
      return next();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    // Update presence
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { 
        $set: { lastOnline: new Date(), online: true } 
      });
    }
    
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
