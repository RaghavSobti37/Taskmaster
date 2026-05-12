const express = require('express');
const router = express.Router();
const { createTask, getTasks, updateTask, updateTaskStatus } = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createTask)
  .get(getTasks);

router.route('/:id')
  .put(updateTask);

router.put('/:id/status', updateTaskStatus);

module.exports = router;
