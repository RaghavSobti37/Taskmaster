import express from 'express';
import { getMyCircle, searchUsers, addToCircle } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/circle').get(protect, getMyCircle).post(protect, addToCircle);

router.get('/search', protect, searchUsers);

export default router;