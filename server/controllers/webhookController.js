const User = require('../models/User');
const Lead = require('../models/Lead');
const { createNotification } = require('../services/notificationDispatcher');
const { buildLeadActionUrl } = require('../utils/notificationActionUrl');
const { assignLeadToRep } = require('./crmController');
const { assignNextBookedCallRep } = require('../utils/bookedCallRepAssignment');
const LeadService = require('../services/LeadService');
const { normalizePersonRecord } = require('../utils/personNormalization');
const { processArtistEnquiryLogic } = require('../services/artistEnquiryService');
const { rejectUnlessBookCallAuthorized, verifyArtistEnquirySecret } = require('../utils/webhookAuth');
/** BOOK_CALL_WEBHOOK_SECRET: x-webhook-secret or HMAC via rejectUnlessWebhookSignature */
const { formatIstFollowupDate, formatIstFollowupTime24 } = require('../utils/istFollowupFormat');

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Setup BullMQ Queue
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  }
});

connection.on('error', () => { });

const webhookQueue = new Queue('WebhookQueue', { connection });
webhookQueue.on('error', () => { });

exports.processBookedCallLogic = async (data) => {
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
    const leadLookup = { $or: [] };
    if (normalizedEmail) leadLookup.$or.push({ email: normalizedEmail });
    if (normalizedPhone) leadLookup.$or.push({ phone: normalizedPhone });
    let lead = leadLookup.$or.length
      ? await Lead.findOne(leadLookup)
      : null;
    let rep = null;

    if (lead && lead.assignedRepId) {
      rep = await User.findById(lead.assignedRepId);
    }

    if (!rep) {
      const repId = (await assignNextBookedCallRep()) || (await assignLeadToRep());
      if (repId) rep = await User.findById(repId);
      if (!rep) throw new Error("No sales rep available");
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
    if (istSlotDate.getTime() < now.getTime() + bufferTime) {
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

    if (lead) {
      await LeadService.updateLead(
        { _id: lead._id },
        {
          $set: {
            ...leadData,
            email: normalizedEmail,
            reminderSent: false,
            notifiedOverdue: false,
          },
        }
      );
      lead = await Lead.findById(lead._id);
    } else {
      lead = await LeadService.createLead({
        email: normalizedEmail,
        ...leadData,
        reminderSent: false,
        notifiedOverdue: false,
      });
    }

    // mergeContact handled by LeadService.syncToContactHub

    if (rep?._id) {
      await createNotification({
        recipientId: rep._id,
        title: 'New Call Booked',
        message: `${name} booked a ${course} call on ${istDateStr} at ${istTimeDisplay}.`,
        category: 'crm',
        type: 'alert',
        relatedLeadId: lead._id,
        actionUrl: buildLeadActionUrl(lead._id),
        sendEmail: false
      });
    }

    // 4. Send AiSensy to Customer
    await sendAiSensyMessage(
      whatsapp || phone,
      'final_book_call_confirmation',
      [name.split(' ')[0], course, istDateStr, istTimeDisplay, whatsapp || phone],
      {
        "FirstName": name.split(' ')[0],
        "CourseName": course,
        "ScheduledDate": istDateStr,
        "ScheduledTime": istTimeDisplay,
        "WhatsAppNumber": whatsapp || phone
      },
      name
    );

    // 5. Send AiSensy to Assigned Rep
    if (rep.phone) {
      await sendAiSensyMessage(
        rep.phone,
        'sales_rep_new_booking_alert',
        [rep.name.split(' ')[0], name, course, istDateStr, istTimeDisplay],
        {
          "RepName": rep.name.split(' ')[0],
          "LeadName": name,
          "CourseName": course,
          "ScheduledDate": istDateStr,
          "ScheduledTime": istTimeDisplay
        },
        rep.name
      );
    } else {
      console.warn(`[Warning] No phone number for rep ${rep.name}, skipping AiSensy notification.`);
    }

    return { success: true, message: 'Call booked in CRM', leadId: lead._id };
  } catch (error) {
    console.error('Webhook Processing Error:', error);
    throw error; // Let BullMQ handle retry
  }
};

exports.processArtistEnquiryLogic = processArtistEnquiryLogic;

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
    const result = await processArtistEnquiryLogic(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Artist enquiry queue error:', error);
    try {
      console.warn('Falling back to synchronous artist-enquiry processing after enqueue error');
      const result = await processArtistEnquiryLogic(req.body);
      return res.status(200).json(result);
    } catch (syncError) {
      console.error('Artist enquiry sync fallback error:', syncError);
      const isValidation = syncError.message?.includes('Missing required fields');
      return res.status(isValidation ? 400 : 500).json({
        success: false,
        error: syncError.message || 'Failed to process artist enquiry',
      });
    }
  }
};

exports.handleBookedCall = async (req, res) => {
  if (!rejectUnlessBookCallAuthorized(req, res)) {
    return;
  }

  try {
    if (connection.status === 'ready') {
      await webhookQueue.add('book-call', req.body, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      });
      return res.status(202).json({ success: true, message: 'Webhook received and queued for processing' });
    } else {
      console.warn('Redis is not ready, falling back to synchronous processing');
      await exports.processBookedCallLogic(req.body);
      return res.status(200).json({ success: true, message: 'Call booked and synced synchronously' });
    }
  } catch (error) {
    console.error('Queue Enqueue Error:', error);
    try {
      console.warn('Falling back to synchronous processing after enqueue error');
      await exports.processBookedCallLogic(req.body);
      return res.status(200).json({ success: true, message: 'Call booked and synced synchronously' });
    } catch (syncError) {
      console.error('Sync Fallback Error:', syncError);
      return res.status(500).json({ error: 'Failed to queue webhook and sync processing failed', details: syncError.message });
    }
  }
};

async function sendAiSensyMessage(destination, campaign, params, attributes, userName) {
  const cleanDestination = destination.replace(/\D/g, '');
  const body = {
    apiKey: process.env.AISENSY_API_KEY,
    campaignName: campaign,
    destination: cleanDestination,
    templateParams: params,
    userName: userName || 'User'
  };
  if (attributes) {
    body.attributes = attributes;
  }

  if (!process.env.AISENSY_API_KEY) {
    console.warn('[Warning] AISENSY_API_KEY not found in environment, skipping fetch');
    return;
  }

  try {
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    console.log(`[AiSensy Webhook Response for ${campaign}]:`, json);
  } catch (e) {
    console.error('[AiSensy] Fetch Error:', e);
  }
}

