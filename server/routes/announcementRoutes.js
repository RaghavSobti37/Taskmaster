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
const FALLBACK_APP_URL = 'https://taskmaster.app';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeTextToHtml = (value = '') => escapeHtml(value).replace(/\n/g, '<br />');

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

const buildAnnouncementEmailHtml = ({ title, message, createdByName, ctaText, ctaLink, expiresAt }) => {
  const safeTitle = escapeHtml(title || 'Announcement');
  const safeCreator = escapeHtml(createdByName || 'CoreKnot Team');
  const safeMessage = normalizeTextToHtml(message || '');
  const safeCtaText = escapeHtml(ctaText || '');
  const safeCtaLink = ctaLink ? escapeHtml(ctaLink) : '';
  const hasExpiry = !!expiresAt;
  const expiryLabel = hasExpiry ? new Date(expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return `
    <div style="background:#f8fafc;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;opacity:0.85;">CoreKnot Announcement</div>
          <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:800;">${safeTitle}</h1>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px;font-size:13px;color:#475569;">
            Sent by <strong>${safeCreator}</strong>
          </p>
          <div style="font-size:15px;line-height:1.65;color:#0f172a;">
            ${safeMessage}
          </div>
          ${hasExpiry ? `<p style="margin:14px 0 0;font-size:12px;color:#b45309;"><strong>Valid until:</strong> ${escapeHtml(expiryLabel)}</p>` : ''}
          ${safeCtaText && safeCtaLink ? `
            <div style="margin-top:22px;">
              <a href="${safeCtaLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;">
                ${safeCtaText}
              </a>
            </div>
          ` : ''}
        </div>
        <div style="padding:14px 22px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          Open CoreKnot: <a href="${escapeHtml(process.env.CLIENT_URL || FALLBACK_APP_URL)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(process.env.CLIENT_URL || FALLBACK_APP_URL)}</a>
        </div>
      </div>
    </div>
  `;
};

const updateAnnouncementOpenCounters = async (doc) => {
  const recipients = doc.emailDispatch?.recipients || [];
  const openedCount = recipients.filter((r) => r.status === 'Opened').length;
  const sentCount = recipients.filter((r) => r.status === 'Sent' || r.status === 'Opened').length;
  const failedCount = recipients.filter((r) => r.status === 'Failed').length;
  doc.emailDispatch.opened = openedCount;
  doc.emailDispatch.sent = sentCount;
  doc.emailDispatch.failed = failedCount;
};

const dispatchAnnouncementEmails = async (announcementId) => {
  try {
    const doc = await Announcement.findById(announcementId).populate('createdBy', 'name').lean();
    if (!doc || !doc.sendEmail) return;

    const recipients = doc.emailDispatch?.recipients || [];
    // #region agent log
    fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'pre-fix',hypothesisId:'H4',location:'announcementRoutes.js:dispatchAnnouncementEmails()',message:'Dispatch worker start',data:{announcementId:String(announcementId),recipientCount:recipients.length,status:doc.emailDispatch?.status||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (recipients.length === 0) {
      await Announcement.findByIdAndUpdate(announcementId, {
        $set: {
          'emailDispatch.status': 'completed',
          'emailDispatch.completedAt': new Date()
        }
      });
      return;
    }

    await Announcement.findByIdAndUpdate(announcementId, {
      $set: {
        'emailDispatch.status': 'sending',
        'emailDispatch.startedAt': new Date()
      }
    });

    const baseUrl = process.env.APP_BASE_URL || process.env.CLIENT_URL || FALLBACK_APP_URL;

    for (const recipient of recipients) {
      await Announcement.findOneAndUpdate(
        { _id: announcementId, 'emailDispatch.recipients._id': recipient._id },
        {
          $set: {
            'emailDispatch.recipients.$.status': 'Sending',
            'emailDispatch.recipients.$.error': ''
          }
        }
      );

      const trackOpenUrl = `${baseUrl.replace(/\/$/, '')}/api/announcements/track/open/${announcementId}/${recipient._id}`;
      const html = `${buildAnnouncementEmailHtml({
        title: doc.title,
        message: doc.message,
        createdByName: doc.createdBy?.name || 'CoreKnot Team',
        ctaText: doc.ctaText,
        ctaLink: doc.ctaLink,
        expiresAt: doc.expiresAt
      })}<img src="${trackOpenUrl}" width="1" height="1" alt="" style="display:none;" />`;

      try {
        const sendResult = await dispatchEmailPayload({
          to: recipient.email,
          subject: `CoreKnot Announcement: ${doc.title}`,
          html
        });
        const messageId = sendResult?.id || sendResult?.data?.id || '';
        // #region agent log
        fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'pre-fix',hypothesisId:'H4',location:'announcementRoutes.js:dispatchAnnouncementEmails()',message:'Recipient send attempt complete',data:{announcementId:String(announcementId),status:'Sent',hasMessageId:!!messageId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        await Announcement.findOneAndUpdate(
          { _id: announcementId, 'emailDispatch.recipients._id': recipient._id },
          {
            $set: {
              'emailDispatch.recipients.$.status': 'Sent',
              'emailDispatch.recipients.$.sentAt': new Date(),
              'emailDispatch.recipients.$.messageId': messageId,
              'emailDispatch.recipients.$.error': ''
            }
          }
        );
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'pre-fix',hypothesisId:'H4',location:'announcementRoutes.js:dispatchAnnouncementEmails()',message:'Recipient send failed',data:{announcementId:String(announcementId),error:String(err?.message||'unknown')},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        await Announcement.findOneAndUpdate(
          { _id: announcementId, 'emailDispatch.recipients._id': recipient._id },
          {
            $set: {
              'emailDispatch.recipients.$.status': 'Failed',
              'emailDispatch.recipients.$.error': err.message || 'Failed'
            }
          }
        );
      }
    }

    const fresh = await Announcement.findById(announcementId);
    if (fresh) {
      updateAnnouncementOpenCounters(fresh);
      fresh.emailDispatch.status = fresh.emailDispatch.failed > 0 ? 'failed' : 'completed';
      fresh.emailDispatch.completedAt = new Date();
      await fresh.save();
    }
  } catch (error) {
    await Announcement.findByIdAndUpdate(announcementId, {
      $set: {
        'emailDispatch.status': 'failed',
        'emailDispatch.completedAt': new Date()
      }
    });
  }
};

router.get('/track/open/:announcementId/:recipientId', async (req, res) => {
  try {
    const { announcementId, recipientId } = req.params;
    const doc = await Announcement.findById(announcementId);
    if (doc) {
      const recipient = doc.emailDispatch?.recipients?.id(recipientId);
      if (recipient && recipient.status !== 'Opened') {
        recipient.status = 'Opened';
        recipient.openedAt = new Date();
        updateAnnouncementOpenCounters(doc);
        await doc.save();
      }
    }
  } catch (error) {
    // Silent tracking endpoint failure by design
  }

  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.end(pixel);
});

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
    const includeExpired = canManage(req.user) && req.query.includeExpired === 'true';
    const memberships = await Project.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }]
    }, '_id').lean();
    const projectIds = memberships.map((p) => p._id);

    const now = new Date();
    const visibilityOr = [
      { audienceType: 'all' },
      { audienceType: 'selected', recipients: req.user._id },
      { audienceType: 'project', projectId: { $in: projectIds } },
      ...(canManage(req.user) ? [{ createdBy: req.user._id }] : [])
    ];
    const expiryFilter = includeExpired ? {} : {
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
    };

    const rows = await Announcement.find({
      $and: [
        { $or: visibilityOr },
        expiryFilter
      ]
    })
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // #region agent log
    fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'post-fix',hypothesisId:'H2',location:'announcementRoutes.js:get/',message:'Announcement list response summary',data:{userId:String(req.user?._id||''),role:req.user?.role||'',includeExpired,nowIso:now.toISOString(),count:rows.length,ids:rows.map(r=>String(r._id)).slice(0,5)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    if (audienceType === 'selected' && (!Array.isArray(recipients) || recipients.length === 0)) {
      return res.status(400).json({ error: 'Select at least one user for selected audience' });
    }
    if (audienceType === 'project' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for project audience' });
    }

    // #region agent log
    fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'pre-fix',hypothesisId:'H1',location:'announcementRoutes.js:post/',message:'Create announcement request',data:{userId:String(req.user?._id||''),audienceType:audienceType||'all',recipientCount:Array.isArray(recipients)?recipients.length:0,hasProjectId:!!projectId,sendEmail:!!sendEmail,hasExpiresAt:!!expiresAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      ctaLink: ctaLink?.trim() || undefined,
      emailDispatch: {
        status: sendEmail ? 'queued' : 'idle',
        startedAt: null,
        completedAt: null,
        total: 0,
        sent: 0,
        opened: 0,
        failed: 0,
        recipients: []
      }
    });

    // #region agent log
    fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'pre-fix',hypothesisId:'H3',location:'announcementRoutes.js:post/',message:'Announcement created document',data:{announcementId:String(doc._id),tenantId:String(doc.tenantId||''),sendEmail:!!doc.sendEmail,expiresAt:doc.expiresAt?new Date(doc.expiresAt).toISOString():null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (sendEmail) {
      const targets = await getRecipientUsers(doc);
      const uniqueTargets = Array.from(new Map(
        (targets || [])
          .filter((user) => user?.email && user.email.includes('@'))
          .map((user) => [String(user.email).toLowerCase().trim(), user])
      ).values());

      // #region agent log
      fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bbd2d'},body:JSON.stringify({sessionId:'8bbd2d',runId:'pre-fix',hypothesisId:'H1',location:'announcementRoutes.js:post/',message:'Resolved targets for dispatch',data:{announcementId:String(doc._id),targetCount:targets.length,uniqueRecipientCount:uniqueTargets.length,audienceType:doc.audienceType},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      doc.emailDispatch.total = uniqueTargets.length;
      doc.emailDispatch.recipients = uniqueTargets.map((u) => ({
        email: String(u.email).toLowerCase().trim(),
        name: u.name || '',
        status: 'Pending'
      }));
      await doc.save();
      setImmediate(() => dispatchAnnouncementEmails(doc._id));
    }

    await GamificationService.awardActionXp(req.user._id, 'ANNOUNCEMENT_CREATED', { announcementId: doc._id });
    const payload = await doc.populate('createdBy', 'name avatar');
    res.status(201).json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ error: 'Not authorized' });

    const doc = await Announcement.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Announcement not found' });

    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
