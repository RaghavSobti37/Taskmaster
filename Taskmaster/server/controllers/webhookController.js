const User = require('../models/User');
const Lead = require('../models/Lead');
const { createNotification } = require('../services/notificationDispatcher');
const { buildLeadActionUrl } = require('../utils/notificationActionUrl');
const { assignLeadToRep, leadService: LeadService } = require('../domains/crm/crmFacade');
const { assignNextBookedCallRep, resolveBookedCallRepPhone } = require('../utils/bookedCallRepAssignment');
const { normalizePersonRecord } = require('../utils/personNormalization');
const { processArtistEnquiryLogic } = require('../domains/artists/artistFacade');
const { processArtistPathWebhook } = require('../domains/artists/services/artistPathImportService');
const {
  verifyArtistEnquirySecret,
  rejectUnlessArtistPathAuthorized,
  rejectUnlessNewsletterAuthorized,
  rejectUnlessMasterclassReviewAuthorized,
} = require('../utils/webhookAuth');
const { processNewsletterWebhook } = require('../services/newsletterWebhookService');
const { processMasterclassReviewWebhook } = require('../services/masterclassReviewService');
const { createLeadFromForm } = require('../domains/crm/services/leadWriteService');
const { sendAiSensyMessage } = require('../utils/aisensyClient');
/** BOOK_CALL_WEBHOOK_SECRET: x-webhook-secret or HMAC via rejectUnlessWebhookSignature */
const { formatIstFollowupDate, formatIstFollowupTime24 } = require('../utils/istFollowupFormat');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { CRM_TYPES } = require('../../shared/artistCrmTaxonomy');
const { getTenantId } = require('../utils/tenantContext');

const REP_BYPASS = bypassOptions('book-call-rep-fetch');
const LEAD_BYPASS = bypassOptions('book-call-lead-lookup');

async function sendBookedCallNotifications(data, rep, lead, istDateStr, istTimeDisplay) {
  const { name, phone, whatsapp, course } = data;
  if (rep?._id) {
    await createNotification({
      recipientId: rep._id,
      title: 'New Call Booked',
      message: `${name} booked a ${course} call on ${istDateStr} at ${istTimeDisplay}.`,
      category: 'crm',
      type: 'alert',
      relatedLeadId: lead._id,
      actionUrl: buildLeadActionUrl(lead._id),
      sendEmail: false,
    });
  }

  await sendAiSensyMessage(
    whatsapp || phone,
    'final_book_call_confirmation',
    [name.split(' ')[0], course, istDateStr, istTimeDisplay, whatsapp || phone],
    {
      FirstName: name.split(' ')[0],
      CourseName: course,
      ScheduledDate: istDateStr,
      ScheduledTime: istTimeDisplay,
      WhatsAppNumber: whatsapp || phone,
    },
    name,
  );

  const repPhone = rep?._id ? await resolveBookedCallRepPhone(rep._id) : null;
  if (repPhone && rep?.name) {
    await sendAiSensyMessage(
      repPhone,
      'sales_rep_new_booking_alert',
      [rep.name.split(' ')[0], name, course, istDateStr, istTimeDisplay],
      {
        RepName: rep.name.split(' ')[0],
        LeadName: name,
        CourseName: course,
        ScheduledDate: istDateStr,
        ScheduledTime: istTimeDisplay,
      },
      rep.name,
    );
  } else if (rep) {
    console.warn(`[Warning] No phone number for rep ${rep.name}, skipping AiSensy notification.`);
  }
}

const { Queue } = require('bullmq');
const { createRedisClient } = require('../utils/wslRedis');

// Setup BullMQ Queue
const connection = createRedisClient();

const webhookQueue = new Queue('WebhookQueue', { connection });
webhookQueue.on('error', () => { });

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

function samePhone(a, b) {
  const left = digitsOnly(a);
  const right = digitsOnly(b);
  return !!left && !!right && left === right;
}

function sameEmail(a, b) {
  return !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function phoneLookupVariants(phone) {
  const variants = new Set();
  if (!phone) return [];
  variants.add(phone);
  const digits = digitsOnly(phone);
  if (digits.length >= 10) {
    const national = digits.startsWith('91') && digits.length >= 12
      ? digits.slice(2, 12)
      : digits.slice(-10);
    if (national) {
      variants.add(national);
      variants.add(`+91${national}`);
      variants.add(`91${national}`);
    }
  }
  return [...variants];
}

function buildBookedCallNote({ name, email, phone, whatsapp, course, referral, date, time, timezone, istDateStr, istTimeStr }) {
  return {
    text: [
      'Booked call input',
      `Name: ${name || ''}`,
      `Email: ${email || ''}`,
      `Phone: ${phone || ''}`,
      `WhatsApp: ${whatsapp || phone || ''}`,
      `Course: ${course || ''}`,
      `Requested slot: ${date || ''} ${time || ''} (${timezone || 'Asia/Kolkata'})`,
      `CRM follow-up: ${istDateStr || ''} ${istTimeStr || ''} IST`,
      referral ? `Referral: ${referral}` : '',
    ].filter(Boolean).join('\n'),
    author: 'Website Booking',
    date: new Date(),
  };
}

function isDuplicateKeyError(error) {
  return error?.code === 11000 || /E11000 duplicate key/i.test(error?.message || '');
}

function toPublicWebhookError(error, fallback = 'Something went wrong. Please try again.') {
  const msg = error?.message || '';
  if (isDuplicateKeyError(error)) {
    return {
      status: 409,
      error: 'We already have this phone number in CoreKnot. Your booking details were not saved. Please use a different number or message the team.',
    };
  }
  if (/slot is no longer/i.test(msg)) return { status: 400, error: 'This slot is no longer available. Please pick a later time.' };
  if (/No sales rep/i.test(msg)) return { status: 503, error: 'Booking is temporarily unavailable. Please try again in a few minutes.' };
  if (/Invalid date|Invalid time/i.test(msg)) return { status: 400, error: 'Please choose a valid date and time.' };
  if (/Missing required|Invalid name|Name is required/i.test(msg)) return { status: 400, error: 'Please enter your name.' };
  if (/Invalid email/i.test(msg)) return { status: 400, error: 'Please enter a valid email address.' };
  if (/Invalid phone|Phone is required|phone format/i.test(msg)) return { status: 400, error: 'Please enter a valid WhatsApp number.' };
  if (/tenant configured|tenant context/i.test(msg)) return { status: 503, error: 'Booking is temporarily unavailable. Please try again in a few minutes.' };
  return { status: error?.status || error?.statusCode || 500, error: fallback };
}

async function findBookedCallLead(normalizedEmail, normalizedPhone, { anyCrmType = false } = {}) {
  const lookup = { $or: [] };
  const tenantId = getTenantId();
  if (tenantId) lookup.tenantId = tenantId;
  if (!anyCrmType) lookup.crmType = CRM_TYPES.SALES;
  if (normalizedEmail) lookup.$or.push({ email: normalizedEmail });
  const phoneVariants = phoneLookupVariants(normalizedPhone);
  if (phoneVariants.length) lookup.$or.push({ phone: { $in: phoneVariants } });
  if (!lookup.$or.length) return null;
  return Lead.findOne(lookup).setOptions(LEAD_BYPASS);
}

async function updateBookedCallLead(lead, leadData, bookingNote, normalizedEmail, normalizedPhone) {
  const set = {
    ...leadData,
    crmType: lead.crmType || leadData.crmType,
    reminderSent: false,
    notifiedOverdue: false,
  };
  if (!lead.email || sameEmail(lead.email, normalizedEmail)) {
    set.email = normalizedEmail;
  }
  if (!lead.phone || samePhone(lead.phone, normalizedPhone)) {
    set.phone = normalizedPhone;
  }
  await LeadService.updateLead(
    { _id: lead._id },
    {
      $set: set,
      $push: { notes: bookingNote },
    }
  );
  return Lead.findById(lead._id);
}

exports.processBookedCallLogic = async (data, options = {}) => {
  const {
    skipSlotValidation = false,
    skipNotifications = false,
    forceRepId = null,
  } = options;
  try {
    const { name, email, phone, whatsapp, course, referral, date, time, timezone = 'Asia/Kolkata' } = data;

    const identity = normalizePersonRecord(
      {
        name,
        email,
        phone: whatsapp || phone,
      },
      { requireName: true, requirePhone: true, tryRepairPhone: true }
    );
    if (identity.errors.length) {
      throw new Error(identity.errors[0]);
    }

    const normalizedName = identity.name;
    const normalizedEmail = identity.email;
    const normalizedPhone = identity.phone;

    // 1. Assign Rep (Only if new lead or lead has no rep)
    let lead = await findBookedCallLead(normalizedEmail, normalizedPhone)
      || await findBookedCallLead(normalizedEmail, normalizedPhone, { anyCrmType: true });
    let rep = null;

    if (lead && lead.assignedRepId) {
      rep = await User.findById(lead.assignedRepId).setOptions(REP_BYPASS);
    }

    if (!rep) {
      const repId = forceRepId || (await assignNextBookedCallRep()) || (await assignLeadToRep());
      if (repId) rep = await User.findById(repId).setOptions(REP_BYPASS);
      if (!rep) throw new Error('No sales rep available');
    }

    // Helper to convert any local time to IST
    const convertToIST = (dStr, tStr, tz) => {
      try {
        const [year, month, day] = dStr.split('-').map(Number);
        const [timePart, period] = tStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        const localClockUTC = Date.UTC(year, month - 1, day, hours, minutes);

        const getOffset = (timestamp, timeZone) => {
          const date = new Date(timestamp);
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
          }).formatToParts(date);

          const getVal = (type) => parseInt(parts.find(p => p.type === type).value);
          const utcAtParts = Date.UTC(getVal('year'), getVal('month') - 1, getVal('day'), getVal('hour'), getVal('minute'));
          return (utcAtParts - timestamp) / 60000;
        };

        let offset = getOffset(localClockUTC, tz);
        const realUTC = localClockUTC - (offset * 60000);
        return new Date(realUTC);
      } catch (e) {
        console.error('Conversion Error:', e);
        return new Date('Invalid');
      }
    };

    const istSlotDate = convertToIST(date, time, timezone);
    if (isNaN(istSlotDate.getTime())) {
      throw new Error('Invalid date or time format provided.');
    }

    const now = new Date();
    const bufferTime = 90 * 60 * 1000; // 1.5 hours
    if (!skipSlotValidation && istSlotDate.getTime() < now.getTime() + bufferTime) {
      throw new Error('This slot is no longer available in your timezone.');
    }

    const istDateStr = formatIstFollowupDate(istSlotDate);
    const istTimeStr = formatIstFollowupTime24(istSlotDate);
    const istTimeDisplay = istSlotDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    // 2. Upsert Lead in CRM
    const leadData = {
      crmType: CRM_TYPES.SALES,
      name: normalizedName,
      nameKey: identity.nameKey,
      phone: normalizedPhone,
      course,
      assignedRepId: rep._id,
      leadStatus: 'Warm',
      callStatus: 'Scheduled',
      source: 'Website Booking',
      nextFollowupDate: istDateStr,
      nextFollowupTime: istTimeStr
    };

    const bookingNote = buildBookedCallNote({
      name,
      email,
      phone,
      whatsapp,
      course,
      referral,
      date,
      time,
      timezone,
      istDateStr,
      istTimeStr,
    });

    if (lead) {
      lead = await updateBookedCallLead(lead, leadData, bookingNote, normalizedEmail, normalizedPhone);
    } else {
      try {
        lead = await LeadService.createLead({
          email: normalizedEmail,
          ...leadData,
          reminderSent: false,
          notifiedOverdue: false,
          notes: [bookingNote],
        });
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        const duplicateLead = await findBookedCallLead(normalizedEmail, normalizedPhone, { anyCrmType: true });
        if (!duplicateLead) throw err;
        lead = await updateBookedCallLead(duplicateLead, leadData, bookingNote, normalizedEmail, normalizedPhone);
      }
    }

    // mergeContact handled by LeadService.syncToContactHub

    if (!skipNotifications) {
      void sendBookedCallNotifications(
        { name, email, phone, whatsapp, course },
        rep,
        lead,
        istDateStr,
        istTimeDisplay,
      ).catch((err) => {
        console.error('Book-call notifications failed:', err.message);
      });
    }

    return {
      success: true,
      message: 'Call booked in CRM',
      leadId: lead._id,
      assignedRepId: rep._id,
      assignedRepName: rep.name,
    };
  } catch (error) {
    console.error('Webhook Processing Error:', error);
    throw error; // Let BullMQ handle retry
  }
};

exports.processArtistEnquiryLogic = processArtistEnquiryLogic;
exports.processArtistPathLogic = processArtistPathWebhook;
exports.processNewsletterLogic = processNewsletterWebhook;
exports.processMasterclassReviewLogic = processMasterclassReviewWebhook;

const compact = (value) => String(value || '').trim();

function buildContactLeadRemarks(data = {}) {
  const rows = [
    ['Submitted', compact(data.submittedAt)],
    ['User type', compact(data.userType)],
    ['Message', compact(data.message)],
    ['Genres', compact(data.genres)],
    ['Experience', compact(data.experience)],
    ['Looking for', compact(data.lookingFor)],
    ['Budget', compact(data.budget)],
    ['Campaign type', compact(data.campaignType)],
    ['Focus area', compact(data.focusArea)],
    ['Capital', compact(data.capital)],
    ['Timeline', compact(data.timeline)],
    ['Source site', compact(data.sourceSite)],
  ].filter(([, value]) => value);

  return rows.map(([label, value]) => `${label}: ${value}`).join('\n');
}

function normalizeContactLeadPayload(data = {}) {
  const userType = compact(data.userType).toLowerCase();
  return {
    name: compact(data.name),
    email: compact(data.email).toLowerCase(),
    phone: compact(data.phone),
    company: compact(data.company),
    source: compact(data.source) || 'TSC Website Contact',
    leadStatus: 'New',
    crmType: CRM_TYPES.SALES,
    remarks: buildContactLeadRemarks(data),
    tags: ['tsc-website', 'contact-form', userType].filter(Boolean),
  };
}

async function processContactLeadWebhook(data) {
  const leadBody = normalizeContactLeadPayload(data);
  const tenantId = getTenantId();
  const systemUser = await User.findOne(tenantId ? { tenantId } : {})
    .setOptions(LEAD_BYPASS)
    .sort({ createdAt: 1 });
  if (!systemUser) throw new Error('No tenant user available for contact lead');

  const result = await createLeadFromForm(systemUser, leadBody, {
    defaultSource: 'TSC Website Contact',
    defaultLeadStatus: 'New',
    defaultCrmType: CRM_TYPES.SALES,
  });
  if (result.error) {
    const err = new Error(result.error);
    err.status = result.status || 400;
    throw err;
  }
  return {
    success: true,
    message: result.created ? 'Contact lead created' : 'Contact lead updated',
    leadId: result.lead?._id,
    created: !!result.created,
  };
}

exports.normalizeContactLeadPayload = normalizeContactLeadPayload;
exports.processContactLeadWebhook = processContactLeadWebhook;

exports.handleArtistPath = async (req, res) => {
  if (!rejectUnlessArtistPathAuthorized(req, res)) {
    return;
  }

  try {
    if (connection.status === 'ready') {
      await webhookQueue.add('artist-path', req.body, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      return res.status(202).json({ success: true, message: 'Artist Path submission received and queued' });
    }
    console.warn('Redis is not ready, falling back to synchronous artist-path processing');
    const result = await runWithDefaultWebhookTenant(() => processArtistPathWebhook(req.body));
    return res.status(200).json(result);
  } catch (error) {
    console.error('Artist Path queue error:', error);
    try {
      const result = await runWithDefaultWebhookTenant(() => processArtistPathWebhook(req.body));
      return res.status(200).json(result);
    } catch (syncError) {
      console.error('Artist Path sync fallback error:', syncError);
      const friendly = toPublicWebhookError(syncError, 'We could not save your artist path. Please try again.');
      return res.status(friendly.status).json({
        success: false,
        error: friendly.error,
      });
    }
  }
};

exports.handleArtistEnquiry = async (req, res) => {
  if (!verifyArtistEnquirySecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    if (connection.status === 'ready') {
      await webhookQueue.add('artist-enquiry', req.body, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      return res.status(202).json({ success: true, message: 'Artist enquiry received and queued for processing' });
    }
    console.warn('Redis is not ready, falling back to synchronous artist-enquiry processing');
    const result = await runWithDefaultWebhookTenant(() => processArtistEnquiryLogic(req.body));
    return res.status(200).json(result);
  } catch (error) {
    console.error('Artist enquiry queue error:', error);
    try {
      console.warn('Falling back to synchronous artist-enquiry processing after enqueue error');
      const result = await runWithDefaultWebhookTenant(() => processArtistEnquiryLogic(req.body));
      return res.status(200).json(result);
    } catch (syncError) {
      console.error('Artist enquiry sync fallback error:', syncError);
      const friendly = toPublicWebhookError(syncError, 'We could not save your enquiry. Please try again.');
      return res.status(friendly.status).json({
        success: false,
        error: friendly.error,
      });
    }
  }
};

exports.handleContactLead = async (req, res) => {
  if (!verifyArtistEnquirySecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await runWithDefaultWebhookTenant(() => processContactLeadWebhook(req.body));
    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    console.error('Contact lead webhook error:', error);
    const friendly = toPublicWebhookError(error, 'We could not save your enquiry. Please try again.');
    return res.status(friendly.status).json({
      success: false,
      error: friendly.error,
    });
  }
};

async function enqueueOrProcess(req, res, jobName, processor) {
  try {
    if (connection.status === 'ready') {
      await webhookQueue.add(jobName, req.body, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      return res.status(202).json({ success: true, message: `${jobName} received and queued` });
    }
    console.warn(`Redis is not ready, falling back to synchronous ${jobName} processing`);
    const result = await runWithDefaultWebhookTenant(() => processor(req.body));
    return res.status(200).json(result);
  } catch (error) {
    console.error(`${jobName} queue error:`, error);
    try {
      const result = await runWithDefaultWebhookTenant(() => processor(req.body));
      return res.status(200).json(result);
    } catch (syncError) {
      console.error(`${jobName} sync fallback error:`, syncError);
      const friendly = toPublicWebhookError(syncError, `We could not process this ${jobName} request. Please try again.`);
      return res.status(friendly.status).json({
        success: false,
        error: friendly.error,
      });
    }
  }
}

exports.handleNewsletter = async (req, res) => {
  if (!rejectUnlessNewsletterAuthorized(req, res)) return;
  return enqueueOrProcess(req, res, 'newsletter', processNewsletterWebhook);
};

exports.handleMasterclassReview = async (req, res) => {
  if (!rejectUnlessMasterclassReviewAuthorized(req, res)) return;
  return enqueueOrProcess(req, res, 'masterclass-review', processMasterclassReviewWebhook);
};

exports.handleBookedCall = async (req, res) => {
  try {
    const result = await runWithDefaultWebhookTenant(() => exports.processBookedCallLogic(req.body));
    return res.status(200).json({
      success: true,
      message: 'Call booked in CRM',
      leadId: result?.leadId,
      assignedRepId: result?.assignedRepId,
      assignedRepName: result?.assignedRepName,
    });
  } catch (error) {
    console.error('Book-call webhook error:', error);
    const friendly = toPublicWebhookError(error, 'We could not save your booking. Please try again.');
    return res.status(friendly.status).json({
      success: false,
      error: friendly.error,
    });
  }
};
