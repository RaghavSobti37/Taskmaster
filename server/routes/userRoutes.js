import express from 'express';
import { getMyTeam, searchUsers, addToTeam, getAllUsers, updateProfile, getProfile } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/team').get(protect, getMyTeam).post(protect, addToTeam);
router.route('/circle').get(protect, getMyTeam).post(protect, addToTeam); // Legacy support
router.get('/all', protect, getAllUsers);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

router.get('/search', protect, searchUsers);

export default router;