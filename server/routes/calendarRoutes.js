const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');
const CalendarEvent = require('../models/CalendarEvent');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const User = require('../models/User');
const { dispatchEmailPayload } = require('../services/mailDriver');
const GamificationService = require('../services/gamificationService');

const buildEventDateTime = (dateOnly, timeStr) => {
  const d = new Date(dateOnly);
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
};

router.use(protect);

async function getUserProjectIds(userId) {
  const projects = await Project.find({ members: userId }).select('_id').lean();
  return projects.map((p) => p._id);
}

async function getAssignedTaskIds(userId) {
  const rows = await TaskAssignment.find({ userId }).select('taskId').lean();
  return rows.map((r) => r.taskId);
}

// GET /api/calendar — fetch all events visible to current user
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const startDate = req.query.start ? new Date(req.query.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const userProjectIds = await getUserProjectIds(req.user._id);

    const eventQuery = {
      date: { $gte: startDate, $lte: endDate },
      $or: [
        { visibility: 'public' },
        { createdBy: req.user._id },
        ...(userProjectIds.length
          ? [{ visibility: 'project', projectId: { $in: userProjectIds } }]
          : []),
      ],
    };

    const events = await CalendarEvent.find(eventQuery)
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name workspace')
      .lean();

    const calendarOnly = events.map((ev) => ({ ...ev, type: 'event', dueDate: ev.date }));

    const assignedTaskIds = await getAssignedTaskIds(req.user._id);
    const taskOr = [{ createdBy: req.user._id }];
    if (assignedTaskIds.length) {
      taskOr.push({ _id: { $in: assignedTaskIds } });
    }

    const taskQuery = {
      dueDate: { $gte: startDate, $lte: endDate, $ne: null },
      status: { $ne: 'done' },
      $or: taskOr,
    };

    const tasks = await Task.find(taskQuery).populate('createdBy', 'name avatar').lean();

    const taskEvents = tasks.map((t) => ({
      _id: t._id,
      title: `[Task] ${t.title}`,
      description: t.description || '',
      date: t.dueDate,
      dueDate: t.dueDate,
      visibility: 'private',
      createdBy: t.createdBy,
      type: 'task',
      eventType: 'event',
      status: t.status,
      priority: t.priority,
      projectId: t.projectId,
    }));

    const combined = [...calendarOnly, ...taskEvents].sort((a, b) => new Date(a.date || a.dueDate) - new Date(b.date || b.dueDate));
    res.json(combined);
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar — create new calendar event
router.post('/', async (req, res) => {
  try {
    const { title, description, date, time, visibility, eventType, workspace, projectId } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    if (visibility === 'project' && !projectId) {
      return res.status(400).json({ error: 'Project is required for project-related visibility' });
    }

    const eventDateTime = buildEventDateTime(date, time);
    const inputDate = new Date(eventDateTime);
    inputDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      return res.status(400).json({ error: 'Cannot create calendar events for past dates' });
    }

    const event = await CalendarEvent.create({
      title,
      description: description || '',
      date: eventDateTime,
      eventType: eventType || 'event',
      visibility: visibility || 'private',
      workspace: visibility === 'project' ? workspace || 'General' : '',
      projectId: visibility === 'project' ? projectId : null,
      createdBy: req.user._id,
    });

    const populated = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name workspace');

    const populatedObj = populated.toObject();
    populatedObj.type = 'event';

    if (visibility === 'public') {
      try {
        const allUsers = await User.find({ email: { $exists: true, $ne: '' } }, 'email name');
        const eventDate = eventDateTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const emailPromises = allUsers.map((user) =>
          dispatchEmailPayload({
            to: user.email,
            subject: `📅 New Public Event: ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e40af;">${title}</h2>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Created by:</strong> ${populated.createdBy.name}</p>
                ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
                <p>
                  <a href="${process.env.CLIENT_URL || 'https://coreknot.app'}/calendar"
                     style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Event
                  </a>
                </p>
              </div>
            `,
            from: 'events@coreknot.io',
          }).catch((err) => console.error(`Failed to send event email to ${user.email}:`, err))
        );

        await Promise.all(emailPromises);
      } catch (emailErr) {
        console.error('Error sending public event emails:', emailErr);
      }
    }

    await GamificationService.awardActionXp(req.user._id, 'CALENDAR_EVENT_CREATED', {
      eventId: event._id,
      visibility: visibility || 'private',
    });

    res.status(201).json(populatedObj);
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /api/calendar/:id — update event (only owner)
router.put('/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this event' });
    }

    const { title, description, date, time, visibility, eventType, workspace, projectId } = req.body;
    if (date) {
      const eventDateTime = buildEventDateTime(date, time);
      const inputDate = new Date(eventDateTime);
      inputDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        return res.status(400).json({ error: 'Cannot set calendar events to past dates' });
      }
      event.date = eventDateTime;
    }
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (eventType) event.eventType = eventType;
    if (visibility) {
      event.visibility = visibility;
      if (visibility === 'project') {
        event.workspace = workspace || 'General';
        event.projectId = projectId || null;
      } else {
        event.workspace = '';
        event.projectId = null;
      }
    }

    await event.save();
    const populated = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name workspace');
    const populatedObj = populated.toObject();
    populatedObj.type = 'event';
    res.json(populatedObj);
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// DELETE /api/calendar/:id — delete event (only owner or admin)
router.delete('/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const isOwner = event.createdBy.toString() === req.user._id.toString();
    const isAdmin = isAdminUser(req.user);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    await CalendarEvent.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Error deleting calendar event:', err);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

module.exports = router;
