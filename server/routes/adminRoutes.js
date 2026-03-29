import express from 'express';
import { getLogs, clearLogs, getAllUsers, getStats, deleteUser, promoteToAdmin } from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import adminOnly from '../middleware/adminMiddleware.js';

const router = express.Router();

// Admin routes - all protected and admin-only
router.get('/logs', protect, adminOnly, getLogs);
router.delete('/logs', protect, adminOnly, clearLogs);
router.get('/users', protect, adminOnly, getAllUsers);
router.delete('/users/:userId', protect, adminOnly, deleteUser);
router.patch('/users/:userId/promote', protect, adminOnly, promoteToAdmin);
router.get('/stats', protect, adminOnly, getStats);

export default router;
