import Task from '../models/Task.js';
import Log from '../models/Log.js';

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res) => {
  const { title, description, priority, assignee, isVisibleInCircle, dueDate } = req.body;

  try {
    // If assignee is not provided, assign it to the creator (personal task)
    const finalAssignee = assignee || req.user.id;
    const isPersonal = req.user.id.toString() === finalAssignee.toString();

    const task = new Task({
      title,
      description,
      priority,
      assignee: finalAssignee,
      isVisibleInCircle,
      dueDate,
      creator: req.user.id,
      isPersonal,
    });

    const createdTask = await task.save();

    // Log the action
    await Log.create({
      user: req.user.id,
      action: 'CREATE_TASK',
      details: { taskId: createdTask._id, title: createdTask.title, assignedTo: finalAssignee },
    });

    res.status(201).json(createdTask);
  } catch (error) {
    res.status(400).json({ message: 'Error creating task', error: error.message });
  }
};

// @desc    Get tasks for a user
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res) => {
  try {
    // Find tasks where the logged-in user is either the creator or the assignee
    const tasks = await Task.find({
      $or: [{ assignee: req.user.id }, { creator: req.user.id }],
    }).populate('creator', 'username').sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Update task status (e.g., mark as complete)
// @route   PUT /api/tasks/:id/status
// @access  Private
export const updateTaskStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Only the assignee or creator can update the status
    if (task.assignee.toString() !== req.user.id.toString() && task.creator.toString() !== req.user.id.toString()) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    task.status = status;
    task.completedAt = status === 'done' ? new Date() : null;

    await task.save();

    // Log the action
    await Log.create({ user: req.user.id, action: 'UPDATE_TASK_STATUS', details: { taskId: task._id, newStatus: status } });

    res.json(task);
  } catch (error)
  {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};