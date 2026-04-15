import express from 'express';
import {
  getDailyLogs,
  getDailyLogByDate,
  saveOrUpdateDailyLog,
  addTaskToLog,
  deleteTaskFromLog,
  getDailyLogStats
} from '../controllers/dailyLogController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all daily logs
router.get('/', protect, getDailyLogs);

// Get daily log statistics
router.get('/stats', protect, getDailyLogStats);

// Get daily log by specific date
router.get('/date', protect, getDailyLogByDate);

// Create or update daily log
router.post('/', protect, saveOrUpdateDailyLog);

// Add task to daily log
router.post('/task/add', protect, addTaskToLog);

// Delete task from daily log
router.post('/task/delete', protect, deleteTaskFromLog);

export default router;
