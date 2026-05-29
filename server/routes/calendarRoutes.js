const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');
const CalendarEvent = require('../models/CalendarEvent');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const { dispatchEmailPayload } = require('../services/mailDriver');
const GamificationService = require('../services/gamificationService');

router.use(protect);

// GET /api/calendar — fetch all events visible to current user
// Returns: public events from everyone + private events from current user
router.get('/', async (req, res) => {
  try {
    // Default to -30 days to +60 days if bounds aren't provided
    const now = new Date();
    const startDate = req.query.start ? new Date(req.query.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const eventQuery = {
      date: { $gte: startDate, $lte: endDate },
      $or: [
        { visibility: 'public' },
        { createdBy: req.user._id }
      ]
    };

    const events = await CalendarEvent.find(eventQuery)
    .populate('createdBy', 'name avatar')
    .lean();

    const taskQuery = {
      dueDate: { $gte: startDate, $lte: endDate, $ne: null },
      status: { $ne: 'done' },
      $or: [
        { createdBy: req.user._id },
        { assignees: req.user._id }
      ]
    };

    const tasks = await Task.find(taskQuery).populate('createdBy', 'name avatar').lean();

    const taskEvents = tasks.map(t => ({
      _id: t._id,
      title: `[Task] ${t.title}`,
      description: t.description || '',
      date: t.dueDate,
      visibility: 'private',
      createdBy: t.createdBy,
      type: 'task',
      status: t.status,
      priority: t.priority,
      projectId: t.projectId
    }));

    const combined = [...events, ...taskEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(combined);
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar — create new calendar event
router.post('/', async (req, res) => {
  try {
    const { title, description, date, visibility } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    const inputDate = new Date(date);
    inputDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      return res.status(400).json({ error: 'Cannot create calendar events for past dates' });
    }

    const event = await CalendarEvent.create({
      title,
      description: description || '',
      date,
      visibility: visibility || 'private',
      createdBy: req.user._id
    });

    const populated = await event.populate('createdBy', 'name avatar');

    // Send email notification for public events
    if (visibility === 'public') {
      try {
        const allUsers = await User.find({ email: { $exists: true, $ne: '' } }, 'email name');
        const eventDate = new Date(date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        const emailPromises = allUsers.map(user => 
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
                  <a href="${process.env.CLIENT_URL || 'https://taskmaster.app'}/calendar" 
                     style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Event
                  </a>
                </p>
              </div>
            `,
            from: 'events@taskmaster.io'
          }).catch(err => console.error(`Failed to send event email to ${user.email}:`, err))
        );
        
        await Promise.all(emailPromises);
        console.log(`✅ Public event emails sent to ${allUsers.length} users`);
      } catch (emailErr) {
        console.error('Error sending public event emails:', emailErr);
        // Don't fail the event creation if emails fail
      }
    }
    await GamificationService.awardActionXp(req.user._id, 'CALENDAR_EVENT_CREATED', {
      eventId: event._id,
      visibility: visibility || 'private'
    });

    // Also create a task for this event
    try {
      // Find or create "Google Calendar" project
      let project = await Project.findOne({ name: 'Google Calendar' });
      if (!project) {
        project = await Project.create({
          name: 'Google Calendar',
          description: 'Tasks synced from calendar inputs',
          outletId: 'SYSTEM', // System-level project
          owner: req.user._id,
          status: 'active'
        });
      }

      await Task.create({
        title: title,
        description: description || 'Calendar Event',
        projectId: project._id,
        dueDate: date,
        createdBy: req.user._id,
        assignees: [req.user._id],
        status: 'todo',
        priority: 'medium'
      });
    } catch (taskErr) {
      console.error('Failed to create task for calendar event:', taskErr);
      // We don't fail the event creation if task creation fails
    }

    res.status(201).json(populated);
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

    const { title, description, date, visibility } = req.body;
    if (date) {
      const inputDate = new Date(date);
      inputDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        return res.status(400).json({ error: 'Cannot set calendar events to past dates' });
      }
      event.date = date;
    }
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (visibility) event.visibility = visibility;

    await event.save();
    const populated = await event.populate('createdBy', 'name avatar');
    res.json(populated);
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
