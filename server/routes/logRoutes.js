const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

router.get('/', protect, async (req, res) => {
  try {
    const { userId, action, lastId, limit = 50, startDate, endDate, origin, status, targetId } = req.query;
    const filter = {};
    
    if (userId && userId !== 'undefined' && userId !== 'null' && userId !== 'all') {
      filter.$or = [{ userId: userId }, { actorId: userId }];
    }
    if (action) filter.action = action;
    if (origin) filter.origin = origin;
    if (status) filter.status = status;
    if (targetId) filter.targetId = targetId;
    
    if (lastId) {
      filter._id = { $lt: lastId };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const logs = await Log.find(filter)
      .sort({ _id: -1 }) // Sort by ID for stable cursor pagination
      .limit(parseInt(limit))
      .populate({ path: 'userId', select: 'name avatar role' })
      .lean();
      
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bug-report', protect, async (req, res) => {
  try {
    const discoveredBugs = await Log.find({ origin: 'QA_AGENT_TEST', status: 'BUG_DETECTED' })
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json({
      totalBugsFound: discoveredBugs.length,
      bugs: discoveredBugs.map(bug => ({
        identifiedAt: bug.timestamp || bug.createdAt,
        subsystem: bug.targetEntity || 'Routing Layer',
        failedAction: bug.actionType || bug.action,
        errorContext: bug.payload?.errorStack || bug.payload?.message || bug.payload || 'No details',
        stepsToReproduce: bug.payload?.stepsTaken || []
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/', protect, async (req, res) => {
  try {
    const { action, targetType, targetId, details } = req.body;
    const log = await Log.create({
      userId: req.user._id,
      action,
      targetType,
      targetId,
      details
    });
    const populatedLog = await Log.findById(log._id).populate('userId', 'name avatar');
    res.status(201).json(populatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    await Log.deleteMany({});
    res.json({ message: 'SYSTEM SIGNALS CLEARED' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/run-qa', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    
    const { fork } = require('child_process');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'runQATests.js');
    const child = fork(scriptPath, [], {
      cwd: path.join(__dirname, '..'),
      silent: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logger.error('QA Tests', `Execution failed with code ${code}`);
        return res.status(500).json({ error: 'QA Test failed with code ' + code, stderr, stdout });
      }
      res.json({ message: 'QA Test completed successfully', stdout });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/:id', protect, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    
    const now = new Date();
    const logDate = new Date(log.createdAt);
    const isSameDay = logDate.getFullYear() === now.getFullYear() && 
                      logDate.getMonth() === now.getMonth() && 
                      logDate.getDate() === now.getDate();
                      
    if (!isSameDay && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Logs are only editable on the day they were created.' });
    }

    if (log.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to edit this log.' });
    }

    const { details } = req.body;
    log.details = { ...log.details, ...details };
    await log.save();
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const now = new Date();
    const logDate = new Date(log.createdAt);
    const isSameDay = logDate.getFullYear() === now.getFullYear() && 
                      logDate.getMonth() === now.getMonth() && 
                      logDate.getDate() === now.getDate();
                      
    if (!isSameDay && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Logs can only be deleted on the day they were created.' });
    }

    if (log.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this log.' });
    }

    await Log.findByIdAndDelete(req.params.id);
    res.json({ message: 'Log deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activity-grid', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await Log.aggregate([
      { $match: { userId, action: 'DAILY_LOG' } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        totalMinutes: {
          $sum: {
            $convert: {
              input: { $arrayElemAt: [{ $split: ['$details.timeSpent', 'h'] }, 0] },
              to: 'double',
              onError: 60.0, // Default to 60 min if "h" missing
              onNull: 60.0
            }
          }
        }
      }},
      { $sort: { _id: 1 } }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
