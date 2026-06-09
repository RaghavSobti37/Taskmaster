const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const TaskService = require('./TaskService');
const { createNotification } = require('./notificationDispatcher');
const { findProjectByArtist, resolveProjectNameFromArtist } = require('../utils/artistEnquiryProjectResolver');
const { broadcastRealtimeEvent } = require('../config/realtime');
const ContactService = require('./ContactService');
const LeadService = require('./LeadService');
const { assignLeadToArtistRep } = require('../utils/crmAssignment');
const { resolvePrimaryCallAssigneeId } = require('../utils/primaryCallAssignee');
const { CRM_TYPES, CONTACT_CATEGORIES } = require('../../shared/artistCrmTaxonomy');
const { normalizePersonRecord } = require('../utils/personNormalization');
const { buildLeadActionUrl } = require('../utils/notificationActionUrl');
const logger = require('../utils/logger');

const BYPASS = { bypassTenant: true };

const pick = (data, keys) => {
  for (const key of keys) {
    const val = data[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
};

function normalizePayload(data = {}) {
  return {
    name: pick(data, ['name']),
    email: pick(data, ['email']),
    phone: pick(data, ['phone']),
    company: pick(data, ['organization', 'company']),
    collaborationType: pick(data, ['collaborationType', 'engagementType']),
    artist: pick(data, ['artist', 'artistTalent']),
    nature: pick(data, ['nature', 'projectNature']),
    whenWhere: pick(data, ['whenWhere', 'whenAndWhere']),
    scaleReach: pick(data, ['scaleReach', 'scale']),
    logistics: pick(data, ['logistics', 'logisticsSupport']),
    vision: pick(data, ['vision', 'extraVision', 'details']),
  };
}

function validatePayload(normalized) {
  const missing = [];
  if (!normalized.name) missing.push('name');
  if (!normalized.email) missing.push('email');
  if (!normalized.phone) missing.push('phone');
  if (!normalized.artist) missing.push('artist');
  if (missing.length) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

function buildDescription(normalized) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const lines = [
    `Submitted: ${timestamp} (IST)`,
    '',
    `Name: ${normalized.name}`,
    `Company: ${normalized.company || '—'}`,
    `Email: ${normalized.email}`,
    `Phone: ${normalized.phone}`,
    `Collaboration type: ${normalized.collaborationType || '—'}`,
    `Artist / talent: ${normalized.artist}`,
    `Project nature: ${normalized.nature || '—'}`,
    `When & where: ${normalized.whenWhere || '—'}`,
    `Scale / reach: ${normalized.scaleReach || '—'}`,
    `Logistics: ${normalized.logistics || '—'}`,
    `Vision / details: ${normalized.vision || '—'}`,
    '',
    'Source: Website Artist Enquiry (/query)',
  ];
  return lines.join('\n');
}

const memberId = (value) => (value?._id || value)?.toString?.() || null;

function getArtistManagementAssignees(project) {
  const ids = new Set();
  for (const entry of project.memberRoles || []) {
    if (entry.role !== 'artist_management') continue;
    const uid = memberId(entry.user);
    if (uid) ids.add(uid);
  }
  if (ids.size === 0) {
    const ownerId = memberId(project.owner);
    if (ownerId) ids.add(ownerId);
  }
  return [...ids];
}

const dispatchTaskNotifications = (payloads = []) => {
  for (const payload of payloads) {
    createNotification(payload).catch((err) => {
      logger.error('artistEnquiry', 'Notification failed', { error: err.message });
    });
  }
};

async function processArtistEnquiryLogic(data) {
  const normalized = normalizePayload(data);
  validatePayload(normalized);

  const projectLean = await findProjectByArtist(normalized.artist);
  if (!projectLean) {
    throw new Error(`No project found for artist "${normalized.artist}"`);
  }

  const project = await Project.findById(projectLean._id).setOptions(BYPASS);
  if (!project) {
    throw new Error(`Project not found: ${projectLean._id}`);
  }

  const owner = await User.findById(project.owner).setOptions(BYPASS);
  if (!owner) {
    throw new Error(`Project owner not found for project ${project.name}`);
  }

  const assigneeIds = getArtistManagementAssignees(project);
  const companyLabel = normalized.company || '—';
  const taskTitle = `Artist enquiry: ${normalized.name} (${companyLabel})`;

  const session = await mongoose.startSession();
  let taskDto;
  let pendingNotifications;

  try {
    await session.withTransaction(async () => {
      const result = await TaskService.createTask(
        {
          title: taskTitle,
          description: buildDescription(normalized),
          status: 'todo',
          priority: 'high',
          type: 'enquiry',
          projectId: project._id,
          workspace: project.workspace || 'TSC ARTISTS',
          assignees: assigneeIds,
        },
        owner,
        session
      );
      taskDto = result.taskDto;
      pendingNotifications = result.pendingNotifications;
    });
  } finally {
    await session.endSession();
  }

  dispatchTaskNotifications(pendingNotifications);
  broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
  broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });

  const assigneeId = (await resolvePrimaryCallAssigneeId())
    || (assigneeIds[0] ? assigneeIds[0] : await assignLeadToArtistRep());
  const artistProject = resolveProjectNameFromArtist(normalized.artist) || project.name;

  const identity = normalizePersonRecord(
    { name: normalized.name, email: normalized.email, phone: normalized.phone },
    { requireName: true, requirePhone: true, tryRepairPhone: true }
  );

  let leadId = null;
  if (!identity.errors.length) {
    const leadLookup = { crmType: CRM_TYPES.ARTIST, $or: [] };
    if (identity.email) leadLookup.$or.push({ email: identity.email });
    if (identity.phone) leadLookup.$or.push({ phone: identity.phone });

    const leadPayload = {
      crmType: CRM_TYPES.ARTIST,
      contactCategory: CONTACT_CATEGORIES.BOOKING_ENQUIRY,
      artistProject,
      name: identity.name,
      email: identity.email,
      phone: identity.phone,
      source: 'Website Artist Enquiry',
      leadStatus: 'New',
      callStatus: 'Scheduled',
      assignedRepId: assigneeId,
      tags: ['booking-enquiry', artistProject?.toLowerCase().replace(/\s+/g, '-')].filter(Boolean),
      metadata: {
        taskId: taskDto._id,
        company: normalized.company,
        collaborationType: normalized.collaborationType,
        nature: normalized.nature,
        whenWhere: normalized.whenWhere,
        scaleReach: normalized.scaleReach,
        logistics: normalized.logistics,
        vision: normalized.vision,
        artist: normalized.artist,
      },
    };

    try {
      let lead = leadLookup.$or.length
        ? await Lead.findOne(leadLookup).setOptions(BYPASS)
        : null;
      if (lead) {
        Object.assign(lead, leadPayload);
        await lead.save();
      } else {
        lead = await LeadService.createLead(leadPayload);
      }
      leadId = lead._id;

      await ContactService.mergeContact({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        recordId: lead._id,
        summary: leadPayload.metadata,
        inletKey: 'artist_crm',
      }, 'artist_crm').catch(() => {});

      await ContactService.mergeContact({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        recordId: lead._id,
        summary: {
          ...leadPayload.metadata,
          source: leadPayload.source,
          artistProject,
          contactCategory: CONTACT_CATEGORIES.BOOKING_ENQUIRY,
        },
        inletKey: 'booked_calls',
      }, 'booked_calls').catch(() => {});

      broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'create' });

      if (assigneeId) {
        createNotification({
          userId: assigneeId,
          type: 'system',
          title: 'New artist booking enquiry',
          message: `${normalized.name} — ${artistProject}`,
          actionUrl: buildLeadActionUrl(lead._id),
        }).catch(() => {});
      }
    } catch (err) {
      logger.warn('artistEnquiry', 'Lead upsert failed', { error: err.message });
    }
  }

  logger.info('artistEnquiry', 'Task created from website enquiry', {
    taskId: taskDto._id,
    projectId: project._id,
    artist: normalized.artist,
  });

  await ContactService.mergeContact({
    name: normalized.name,
    email: normalized.email,
    phone: normalized.phone,
    recordId: taskDto._id,
    summary: {
      artist: normalized.artist,
      company: normalized.company,
      collaborationType: normalized.collaborationType,
    },
    inletKey: 'enquiries',
  }, 'enquiries').catch(() => {});

  return {
    success: true,
    message: 'Artist enquiry task created',
    taskId: taskDto._id,
    leadId,
    projectId: project._id,
  };
}

module.exports = {
  normalizePayload,
  processArtistEnquiryLogic,
};
