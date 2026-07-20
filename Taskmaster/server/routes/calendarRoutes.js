const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');
const CalendarEvent = require('../models/CalendarEvent');
const { seedMusicContentCalendar } = require('../services/musicCalendarSeedService');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const User = require('../models/User');
const { assertEmailDispatchSucceeded, dispatchEmailPayload } = require('../services/mailDriver');
const GamificationService = require('../services/gamificationService');
const TenantMembership = require('../models/TenantMembership');
const { validateCalendarEventRange, buildDateTimeFromParts, toDateKey } = require('../utils/dateValidation');
const { formatWeekdayDateLong } = require('../../shared/dateDisplay');
const { validateQuery } = require('../validation/validateQuery');
const { validateBody } = require('../validation/validateBody');
const { calendarQuery, calendarEventBody } = require('../validation/schemas/calendar');
const { escapeHtml, safeHref } = require('../utils/emailHtml');

function normalizeMeetingLink(link) {
  if (!link || typeof link !== 'string') return '';
  const trimmed = link.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

const calendarPage = requirePageAccess('calendar');

router.use(protect);
router.use(calendarPage);

async function getUserProjectIds(userId) {
  const projects = await Project.find({ members: userId }).select('_id').lean();
  return projects.map((p) => p._id);
}

async function getAssignedTaskIds(userId) {
  const rows = await TaskAssignment.find({ userId }).select('taskId').lean();
  return rows.map((r) => r.taskId);
}

// GET /api/calendar — fetch all events visible to current user
router.get('/', validateQuery(calendarQuery), async (req, res) => {
  try {
    const now = new Date();
    const startDate = req.query.start ? new Date(req.query.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const userProjectIds = await getUserProjectIds(req.user._id);

    const eventQuery = {
      $and: [
        {
          $or: [
            { visibility: 'public' },
            { createdBy: req.user._id },
            ...(userProjectIds.length
              ? [{ visibility: 'project', projectId: { $in: userProjectIds } }]
              : []),
          ],
        },
        {
          $or: [
            { endDate: { $gte: startDate }, date: { $lte: endDate } },
            { endDate: null, date: { $gte: startDate, $lte: endDate } },
            { endDate: { $exists: false }, date: { $gte: startDate, $lte: endDate } },
          ],
        },
      ],
    };

    const events = await CalendarEvent.find(eventQuery)
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name workspace')
      .lean();

    const calendarOnly = events.map((ev) => ({
      ...ev,
      type: 'event',
      dueDate: ev.date,
      endDate: ev.endDate || ev.date,
    }));

    const assignedTaskIds = await getAssignedTaskIds(req.user._id);
    const taskOr = [
      { createdBy: req.user._id },
      { mentionAccessIds: req.user._id },
    ];
    if (assignedTaskIds.length) {
      taskOr.push({ _id: { $in: assignedTaskIds } });
    }

    const taskQuery = {
      dueDate: { $gte: startDate, $lte: endDate, $ne: null },
      status: { $ne: 'done' },
      $or: taskOr,
    };

    const tasks = await Task.find(taskQuery).populate('createdBy', 'name avatar').lean();

    const taskEvents = tasks.map((t) => {
      const dateKey = toDateKey(t.dueDate);
      const atNine = dateKey ? buildDateTimeFromParts(dateKey, '09:00') : t.dueDate;
      return {
        _id: t._id,
        title: `[Task] ${t.title}`,
        description: t.description || '',
        date: atNine,
        dueDate: atNine,
        visibility: 'private',
        createdBy: t.createdBy,
        type: 'task',
        eventType: 'event',
        status: t.status,
        priority: t.priority,
        projectId: t.projectId,
      };
    });

    const combined = [...calendarOnly, ...taskEvents].sort((a, b) => new Date(a.date || a.dueDate) - new Date(b.date || b.dueDate));
    res.json(combined);
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar/seed-music-content — admin: import Music Content Calendar birthdays
router.post('/seed-music-content', async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const year = req.body?.year ? Number(req.body.year) : new Date().getFullYear();
    const result = await seedMusicContentCalendar({
      year,
      dryRun: false,
      creatorUserId: req.user._id,
      tenantId: req.tenantId,
    });
    res.json({
      message: `Music Content Calendar seeded for ${year}`,
      ...result,
    });
  } catch (err) {
    console.error('Error seeding music calendar:', err);
    res.status(500).json({ error: err.message || 'Failed to seed music calendar' });
  }
});

// POST /api/calendar — create new calendar event
router.post('/', validateBody(calendarEventBody), async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      time,
      startDate,
      startTime,
      endDate: endDateInput,
      endTime,
      visibility,
      eventType,
      meetingLink,
      workspace,
      projectId,
    } = req.body;

    const dateOnly = startDate || date;
    const timeOnly = startTime || time || '09:00';

    if (!title || !dateOnly) {
      return res.status(400).json({ error: 'Title and start date are required' });
    }

    if (visibility === 'project' && !projectId) {
      return res.status(400).json({ error: 'Project is required for project-related visibility' });
    }

    const rangeCheck = validateCalendarEventRange({
      startDate: dateOnly,
      startTime: timeOnly,
      endDate: endDateInput || dateOnly,
      endTime: endTime || timeOnly,
    });
    if (!rangeCheck.ok) {
      return res.status(400).json({ error: rangeCheck.error });
    }
    const { start: eventDateTime, end: eventEndDateTime } = rangeCheck;

    const resolvedType = eventType || 'event';
    const event = await CalendarEvent.create({
      title,
      description: description || '',
      date: eventDateTime,
      endDate: eventEndDateTime,
      eventType: resolvedType,
      meetingLink: resolvedType === 'meeting' ? normalizeMeetingLink(meetingLink) : '',
      visibility: visibility || 'public',
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
        const membershipRows = await TenantMembership.find({
          tenantId: req.tenantId,
          status: 'active',
        }).select('userId').lean();
        const memberIds = membershipRows.map((row) => row.userId).filter(Boolean);
        const allUsers = memberIds.length
          ? await User.find({ _id: { $in: memberIds }, email: { $exists: true, $ne: '' } }, 'email name')
          : [];
        const eventDate = formatWeekdayDateLong(eventDateTime);

        const safeCalendarUrl = safeHref(`${process.env.CLIENT_URL || 'https://coreknot.app'}/calendar`, 'https://coreknot.app/calendar');
        const safeTitle = escapeHtml(title);
        const safeEventDate = escapeHtml(eventDate);
        const safeCreator = escapeHtml(populated.createdBy?.name || 'CoreKnot Team');
        const safeDescription = description ? escapeHtml(description) : '';

        const emailPromises = allUsers.map(async (user) => {
          const sendResult = await dispatchEmailPayload({
            to: user.email,
            subject: `📅 New Public Event: ${title}`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:28px;color:#cbd5e1;">
                <h2 style="color:#2dd4bf;margin:0 0 16px;font-size:20px;font-weight:600;">${safeTitle}</h2>
                <p style="margin:0 0 8px;line-height:1.6;"><strong style="color:#f8fafc;">Date:</strong> ${safeEventDate}</p>
                <p style="margin:0 0 8px;line-height:1.6;"><strong style="color:#f8fafc;">Created by:</strong> ${safeCreator}</p>
                ${safeDescription ? `<p style="margin:0 0 16px;line-height:1.6;"><strong style="color:#f8fafc;">Description:</strong> ${safeDescription}</p>` : ''}
                <p style="margin:0;">
                  <a href="${safeCalendarUrl}"
                     style="background-color:#126d5e;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
                    View Event
                  </a>
                </p>
              </div>
            `,
            from: 'events@coreknot.io',
          });
          return assertEmailDispatchSucceeded(sendResult, 'Calendar event email dispatch failed');
        });

        await Promise.all(emailPromises);
      } catch (emailErr) {
        console.error('Error sending public event emails:', emailErr);
      }
    }

    await GamificationService.awardActionXp(req.user._id, 'CALENDAR_EVENT_CREATED', {
      eventId: event._id,
      visibility: visibility || 'public',
    });

    res.status(201).json(populatedObj);
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /api/calendar/:id — update event (only owner)
router.put('/:id', validateBody(calendarEventBody), async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this event' });
    }

    const { title, description, date, time, startDate, startTime, endDate: endDateInput, endTime, visibility, eventType, meetingLink, workspace, projectId } = req.body;
    const dateOnly = startDate || date;
    const timeOnly = startTime || time;

    if (dateOnly) {
      const rangeCheck = validateCalendarEventRange({
        startDate: dateOnly,
        startTime: timeOnly || '09:00',
        endDate: endDateInput || dateOnly,
        endTime: endTime || timeOnly || '09:00',
      });
      if (!rangeCheck.ok) {
        return res.status(400).json({ error: rangeCheck.error });
      }
      event.date = rangeCheck.start;
      event.endDate = rangeCheck.end;
    }
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (eventType) event.eventType = eventType;
    const resolvedType = eventType || event.eventType;
    if (meetingLink !== undefined || (eventType && resolvedType !== 'meeting')) {
      event.meetingLink = resolvedType === 'meeting'
        ? normalizeMeetingLink(meetingLink)
        : '';
    }
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
