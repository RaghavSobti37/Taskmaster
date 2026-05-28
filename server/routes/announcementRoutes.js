const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Project = require('../models/Project');
const { dispatchEmailPayload } = require('../services/mailDriver');
const GamificationService = require('../services/gamificationService');

const OPS_ROLES = new Set(['admin', 'ops', 'operations', 'Operations']);
const canManage = (user) => OPS_ROLES.has(user?.role);

const getRecipientUsers = async (announcement) => {
  if (announcement.audienceType === 'all') {
    return User.find({}, 'email name').lean();
  }

  if (announcement.audienceType === 'selected') {
    return User.find({ _id: { $in: announcement.recipients || [] } }, 'email name').lean();
  }

  if (announcement.audienceType === 'project' && announcement.projectId) {
    const project = await Project.findById(announcement.projectId).select('owner members').lean();
    if (!project) return [];
    const ids = new Set([String(project.owner), ...(project.members || []).map((id) => String(id))]);
    return User.find({ _id: { $in: Array.from(ids) } }, 'email name').lean();
  }

  return [];
};

router.use(protect);

router.get('/targets', async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Not authorized' });
    const [users, projects] = await Promise.all([
      User.find({}, 'name email role').sort({ name: 1 }).lean(),
      Project.find({}, 'name').sort({ name: 1 }).lean()
    ]);
    res.json({ users, projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const myId = String(req.user._id);
    const memberships = await Project.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }]
    }, '_id').lean();
    const projectIds = memberships.map((p) => p._id);

    const now = new Date();
    const rows = await Announcement.find({
      $and: [
        {
          $or: [
            { audienceType: 'all' },
            { audienceType: 'selected', recipients: req.user._id },
            { audienceType: 'project', projectId: { $in: projectIds } },
            ...(canManage(req.user) ? [{ createdBy: myId }] : [])
          ]
        },
        {
          $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
        }
      ]
    })
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Not authorized' });
    const { title, message, audienceType, recipients, projectId, sendEmail = true, expiresAt, ctaText, ctaLink } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message are required' });

    const doc = await Announcement.create({
      title,
      message,
      audienceType: audienceType || 'all',
      recipients: Array.isArray(recipients) ? recipients : [],
      projectId: projectId || null,
      sendEmail: !!sendEmail,
      createdBy: req.user._id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ctaText: ctaText?.trim() || undefined,
      ctaLink: ctaLink?.trim() || undefined
    });

    if (sendEmail) {
      const targets = await getRecipientUsers(doc);
      await Promise.allSettled(
        targets.map((user) =>
          dispatchEmailPayload({
            to: user.email,
            subject: `CoreKnot Announcement: ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
                <h2>${title}</h2>
                <p>${message}</p>
                <p><a href="${process.env.CLIENT_URL || 'https://taskmaster.app'}/dashboard">Open CoreKnot</a></p>
              </div>
            `
          })
        )
      );
    }

    await GamificationService.awardActionXp(req.user._id, 'ANNOUNCEMENT_CREATED', { announcementId: doc._id });
    const payload = await doc.populate('createdBy', 'name avatar');
    res.status(201).json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
