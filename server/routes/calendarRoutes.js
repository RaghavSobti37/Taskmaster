const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const CalendarEvent = require('../models/CalendarEvent');

router.use(protect);

// GET /api/calendar — fetch all events visible to current user
// Returns: public events from everyone + private events from current user
router.get('/', async (req, res) => {
  try {
    const events = await CalendarEvent.find({
      $or: [
        { visibility: 'public' },
        { createdBy: req.user._id }
      ]
    })
    .populate('createdBy', 'name avatar')
    .sort({ date: 1 });

    res.json(events);
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

    const event = await CalendarEvent.create({
      title,
      description: description || '',
      date,
      visibility: visibility || 'private',
      createdBy: req.user._id
    });

    const populated = await event.populate('createdBy', 'name avatar');
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
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (date) event.date = date;
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
    const isAdmin = req.user.role === 'admin';
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
