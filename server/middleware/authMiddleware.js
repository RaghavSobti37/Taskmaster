import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('[AUTH] Verifying token...');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        console.log('[AUTH] User not found for token');
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      console.log('[AUTH] Token verified for user:', req.user.email);
      return next();
    } catch (error) {
      console.error('[AUTH] Token verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  console.log('[AUTH] No token provided');
  return res.status(401).json({ message: 'Not authorized, no token' });
};