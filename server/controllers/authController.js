import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Utility to generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    console.log('[REGISTER] ===== REQUEST RECEIVED =====');
    console.log('[REGISTER] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[REGISTER] Extracted values:', { username, email, passwordLength: password?.length });
    console.log('[REGISTER] Request headers:', req.headers);

    if (!username || !email || !password) {
      console.log('[REGISTER] ❌ Missing required fields');
      console.log('[REGISTER] username present:', !!username);
      console.log('[REGISTER] email present:', !!email);
      console.log('[REGISTER] password present:', !!password);
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    console.log('[REGISTER] ✓ All fields present, checking for existing user');
    let user = await User.findOne({ email });
    if (user) {
      console.log('[REGISTER] ❌ Email already exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    console.log('[REGISTER] ✓ Email is unique, creating user');
    user = new User({
      username,
      email,
      password,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    console.log('[REGISTER] ✓ Password hashed, saving user...');

    await user.save();
    console.log('[REGISTER] ✓ User saved successfully:', user._id);

    const token = generateToken(user._id);
    console.log('[REGISTER] ✓ JWT token generated');

    const responseData = {
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    };
    
    console.log('[REGISTER] ✓ Sending response:', JSON.stringify(responseData, null, 2));
    res.status(201).json(responseData);
  } catch (error) {
    console.error('[REGISTER] ❌ SERVER ERROR:', error.message);
    console.error('[REGISTER] Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const { login, password } = req.body;

  try {
    console.log('[LOGIN] ===== REQUEST RECEIVED =====');
    console.log('[LOGIN] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[LOGIN] Extracted values:', { login, passwordLength: password?.length });
    console.log('[LOGIN] Request headers:', req.headers);

    if (!login || !password) {
      console.log('[LOGIN] ❌ Missing credentials');
      console.log('[LOGIN] login present:', !!login);
      console.log('[LOGIN] password present:', !!password);
      return res.status(400).json({ message: 'Email/username and password are required' });
    }

    console.log('[LOGIN] ✓ Both fields present, finding user...');
    let user = await User.findOne({
      $or: [{ email: login }, { username: login }],
    });
    
    if (!user) {
      console.log('[LOGIN] ❌ User not found with:', login);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('[LOGIN] ✓ User found:', user.email, '- comparing password...');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('[LOGIN] ❌ Password mismatch for user:', login);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('[LOGIN] ✓ Password matched');

    // Update login timestamp and login count
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();
    console.log('[LOGIN] ✓ Login count updated');

    const token = generateToken(user._id);
    console.log('[LOGIN] ✓ JWT token generated');

    const responseData = {
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    };
    
    console.log('[LOGIN] ✓ Login successful for user:', user.email);
    console.log('[LOGIN] ✓ Sending response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
  } catch (error) {
    console.error('[LOGIN] ❌ SERVER ERROR:', error.message);
    console.error('[LOGIN] Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get logged in user data
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  // req.user is attached by the protect middleware
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};