import express from 'express';
import { 
  getLogs, 
  clearLogs, 
  getAllUsers, 
  getStats, 
  deleteUser, 
  promoteToAdmin,
  toggleUserDisable,
  changeUserPassword,
  getUserLoginHistory,
  getUserDailyLogs,
  getAllDailyLogs,
  makeServerAdmin
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import adminOnly from '../middleware/adminMiddleware.js';

const router = express.Router();

// Admin routes - all protected and admin-only
router.get('/logs', protect, adminOnly, getLogs);
router.delete('/logs', protect, adminOnly, clearLogs);
router.get('/users', protect, adminOnly, getAllUsers);
router.delete('/users/:userId', protect, adminOnly, deleteUser);
router.patch('/users/:userId/promote', protect, adminOnly, promoteToAdmin);
router.patch('/users/:userId/toggle-disable', protect, adminOnly, toggleUserDisable);
router.patch('/users/:userId/change-password', protect, adminOnly, changeUserPassword);
router.patch('/users/:userId/make-server-admin', protect, adminOnly, makeServerAdmin);
router.get('/users/:userId/login-history', protect, adminOnly, getUserLoginHistory);
router.get('/users/:userId/daily-logs', protect, adminOnly, getUserDailyLogs);
router.get('/stats', protect, adminOnly, getStats);
router.get('/daily-logs', protect, adminOnly, getAllDailyLogs);

export default router;
