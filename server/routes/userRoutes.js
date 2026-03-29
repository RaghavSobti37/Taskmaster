import express from 'express';
import { getMyTeam, searchUsers, addToTeam } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/team').get(protect, getMyTeam).post(protect, addToTeam);
router.route('/circle').get(protect, getMyTeam).post(protect, addToTeam); // Legacy support

router.get('/search', protect, searchUsers);

export default router;