const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  getTask,
  getTaskActivity,
  postTaskActivity,
  updateTask,
  deleteTask,
  reportBug,
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/bug', reportBug);

router.route('/')
  .post(createTask)
  .get(getTasks);

router.get('/:id/activity', getTaskActivity);
router.post('/:id/activity', postTaskActivity);

router.route('/:id')
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

module.exports = router;
