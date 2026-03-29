import express from 'express';
import { check } from 'express-validator';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { handleValidationErrors } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.post(
  '/register',
  [
    check('username', 'Username is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
  ],
  handleValidationErrors,
  registerUser
);

router.post(
  '/login',
  [
    check('login', 'Email or Username is required').not().isEmpty(),
    check('password', 'Password is required').exists(),
  handleValidationErrors,
  ],
  loginUser
);

router.get('/me', protect, getMe);

export default router;