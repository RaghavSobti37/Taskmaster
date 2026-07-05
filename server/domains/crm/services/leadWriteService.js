const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const Lead = require('../models/Lead');
const leadRepository = require('../repositories/leadRepository');
const EMI = require('../models/EMI');
const CRMImport = require('../models/CRMImport');
const {
  sanitizeEmail,
  isValidEmail,
  isValidPhone,
  repairPhone,
  isCorruptLeadPhone,
} = require('../../person/identity');
const {
  ALLOWED_LEAD_FIELDS,
  clearBlockingDuplicateLead,
  mergeCorruptLeadIntoKeeper,
} = require('./leadDuplicateService');
const { sendAiSensyMessage } = require('../../../utils/aisensyClient');
const { dispatchEmailPayload } = require('../../../services/mailDriver');
const { broadcastRealtimeEvent } = require('../../../config/realtime');
const { queueGamificationEvent } = require('../../../services/backgroundQueue');
const { getDepartmentSlug, ARTIST_SLUG } = require('../../../utils/departmentPermissions');
const { CRM_TYPES } = require('../../../../shared/artistCrmTaxonomy');
const { normalizeAndValidateLeadFields } = require('../../../utils/leadValidation');
const { assignLeadToRep, assignLeadToArtistRep } = require('../../../utils/crmAssignment');
const { applyCrmScopeToQuery, shouldRestrictCrmMutationsToOwn } = require('../../../utils/crmScope');
const auditService = require('./auditService');
const { getTenantId } = require('../../../utils/tenantContext');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');

const TENANT_SAFE_LOOKUP = bypassOptions('crm_lead_duplicate_check');

const ALLOWED_EMI_FIELDS = ['installmentNo', 'dueDate', 'amount', 'status', 'paidAt'];

const pick = (src, keys) => {
  const r = {};
  for (const k of keys) { if (src[k] !== undefined) r[k] = src[k]; }
  return r;
};

const phoneDigits = (phone) => String(phone || '').replace(/\D/g, '');

const resolveLeadTenantId = (user) => user?.tenantId || getTenantId();

const phoneLookupVariants = (phone) => {
  const variants = new Set();
  if (!phone) return variants;
  variants.add(phone);
  const digits = phoneDigits(phone);
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
};

async function findExistingLeadIdentityConflict(leadData, user) {
  const tenantId = resolveLeadTenantId(user);
  const base = { crmType: leadData.crmType || CRM_TYPES.SALES };
  if (tenantId) base.tenantId = tenantId;

  if (leadData.phone) {
    const variants = phoneLookupVariants(leadData.phone);
    const byPhone = await Lead.findOne({ ...base, phone: { $in: variants } })
      .setOptions(TENANT_SAFE_LOOKUP)
      .lean();
    if (byPhone) return byPhone;
  }

  if (leadData.email) {
    const byEmail = await Lead.findOne({ ...base, email: String(leadData.email).toLowerCase() })
      .setOptions(TENANT_SAFE_LOOKUP)
      .lean();
    if (byEmail) return byEmail;
  }

  if (leadData.rowId) {
    const byRow = await Lead.findOne({ ...base, rowId: leadData.rowId })
      .setOptions(TENANT_SAFE_LOOKUP)
      .lean();
    if (byRow) return byRow;
  }

  return null;
}

const inferCrmTypeForUser = (user, bodyCrmType) => {
  if (bodyCrmType === CRM_TYPES.ARTIST || bodyCrmType === CRM_TYPES.SALES) return bodyCrmType;
  const slug = getDepartmentSlug(user);
  if (slug === ARTIST_SLUG) return CRM_TYPES.ARTIST;
  return CRM_TYPES.SALES;
};

const validateLeadInput = (leadData, { requireName = false, requirePhone = false } = {}) => {
  const errors = normalizeAndValidateLeadFields(leadData, {
    requireName,
    requirePhone,
    tryRepairPhone: true,
  });
  if (errors.length) {
    return { error: errors[0], status: 400 };
  }
  return null;
};

/** Skip no-op contact normalizations that can trigger duplicate unique indexes on update. */
const prepareLeadContactUpdates = (updates, currentLead) => {
  if (updates.phone !== undefined) {
    if (updates.phone === '' || updates.phone == null) {
      delete updates.phone;
    } else {
      const { validatePhoneE164 } = require('../../../utils/phoneCountryValidation');
      const check = validatePhoneE164(updates.phone);
      if (!check.valid) {
        return { error: check.error, status: 400 };
      }
      const normalized = check.phone;
      const existingNormalized = repairPhone(currentLead?.phone);
      if (phoneDigits(normalized) === phoneDigits(existingNormalized)) {
        delete updates.phone;
      } else {
        updates.phone = normalized;
      }
    }
  }

  if (updates.name !== undefined && updates.name !== '') {
    const nameErrors = normalizeAndValidateLeadFields(updates, { requireName: true });
    if (nameErrors.length) {
      return { error: nameErrors[0], status: 400 };
    }
  }

  if (updates.email !== undefined) {
    if (updates.email === '' || updates.email == null) {
      delete updates.email;
    } else {
      const normalized = sanitizeEmail(updates.email);
      const existing = sanitizeEmail(currentLead?.email || '');
      if (normalized === existing) {
        delete updates.email;
      } else {
        updates.email = normalized;
        if (!isValidEmail(updates.email)) {
          return { error: 'Invalid email format', status: 400 };
        }
      }
    }
  }

  return null;
};

async function sendFirstCallNotifications(lead) {
  if (!lead.phone && !lead.email) return;

  const leadName = lead.name || 'Prospect';
  const courseTitle = lead.exlyOfferingTitle || 'Our Program';
  const paymentLink = process.env.PAYMENT_LINK || 'https://payment.coreknot.io';

  if (lead.phone) {
    const cleanPhone = lead.phone.replace(/\D/g, '');
    await sendAiSensyMessage(
      cleanPhone,
      'call_completed',
      [leadName, courseTitle, paymentLink],
      null,
      lead.name,
    );
    logger.info('leadWriteService', 'WhatsApp sent after first call', { phone: lead.phone });
  }

  if (lead.email) {
    await dispatchEmailPayload({
      to: lead.email,
      subject: `Great! We connected - Next steps for ${courseTitle}`,
      html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:28px;color:#cbd5e1;">
                <h2 style="color:#2dd4bf;margin:0 0 16px;font-size:20px;font-weight:600;">Hi ${leadName},</h2>
                <p style="margin:0 0 16px;line-height:1.6;">Thank you for connecting with us! We're excited to help you with <strong style="color:#f8fafc;">${courseTitle}</strong>.</p>
                <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Next Steps</p>
                <ol style="margin:0 0 20px;padding-left:20px;line-height:1.6;">
                  <li>Review the course details and curriculum</li>
                  <li>Proceed with payment using the link below</li>
                  <li>Complete the enrollment process</li>
                </ol>
                <p style="margin:0 0 24px;">
                  <a href="${paymentLink}" 
                     style="background-color:#126d5e;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
                    Complete Payment
                  </a>
                </p>
                <p style="margin:0 0 8px;line-height:1.6;">If you have any questions, feel free to reach out!</p>
                <p style="margin:0;color:#64748b;font-size:13px;">Best regards,<br/>The Team</p>
              </div>
            `,
      from: 'support@coreknot.io',
    });
    logger.info('crm', `Email sent to ${lead.email}`);
  }
}

async function runPostCreateLeadSideEffects(lead, user) {
  const ContactService = require('../../../services/ContactService');
  try {
    await ContactService.mergeContact({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      recordId: lead._id,
      summary: { leadStatus: lead.leadStatus, source: lead.source },
    }, 'crm');
  } catch (err) {
    logger.error('leadWriteService', 'mergeContact after lead create', {
      leadId: lead._id,
      error: err.message || err,
    });
  }

  try {
    broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'create' });
  } catch (err) {
    logger.error('leadWriteService', 'realtime broadcast after lead create', {
      leadId: lead._id,
      error: err.message || err,
    });
  }

  try {
    const { emitTenantEvent } = require('../../../services/enterpriseWebhook');
    emitTenantEvent(lead.tenantId, 'lead.created', {
      id: String(lead._id),
      name: lead.name,
      email: lead.email,
      source: lead.source,
      leadStatus: lead.leadStatus,
    });
  } catch (err) {
    logger.error('leadWriteService', 'webhook after lead create', {
      leadId: lead._id,
      error: err.message || err,
    });
  }

  try {
    const xpJob = queueGamificationEvent('LEAD_CAPTURED', {
      userId: user._id,
      lead: { _id: lead._id },
    });
    const { isQaSyncGamification } = require('../../../utils/qaProbeContext');
    if (isQaSyncGamification()) await xpJob;
  } catch (err) {
    logger.error('leadWriteService', 'gamification after lead create', {
      leadId: lead._id,
      error: err.message || err,
    });
  }
}

async function createLead(user, body) {
  const leadData = { ...pick(body, ALLOWED_LEAD_FIELDS), createdBy: user._id };
  leadData.crmType = inferCrmTypeForUser(user, leadData.crmType);
  const requirePhone = leadData.crmType !== CRM_TYPES.ARTIST;
  const validation = validateLeadInput(leadData, { requireName: true, requirePhone });
  if (validation) return validation;

  const existing = await findExistingLeadIdentityConflict(leadData, user);
  if (existing) {
    return {
      error: 'A lead with this phone or email already exists',
      status: 409,
      duplicateOf: existing._id,
    };
  }

  if (!leadData.assignedRepId) {
    leadData.assignedRepId = leadData.crmType === CRM_TYPES.ARTIST
      ? await assignLeadToArtistRep()
      : await assignLeadToRep();
  }

  const PersonIdentityService = require('../../../services/PersonIdentityService');
  const resolved = await PersonIdentityService.resolvePerson(
    { name: leadData.name, email: leadData.email, phone: leadData.phone, city: leadData.city },
    { source: 'lead' },
  );
  if (resolved?.personId) {
    leadData.personId = resolved.personId;
  }

  let lead;
  try {
    lead = await Lead.create(leadData);
  } catch (err) {
    if (err?.code === 11000) {
      return {
        error: 'A lead with this phone or email already exists',
        status: 409,
      };
    }
    throw err;
  }
  await runPostCreateLeadSideEffects(lead, user);

  return { lead, status: 201 };
}

async function updateLead(user, leadId, body) {
  const bodyKeys = Object.keys(body || {});
  const disallowed = bodyKeys.filter((k) => !ALLOWED_LEAD_FIELDS.includes(k));
  if (disallowed.length > 0) {
    return { error: `Disallowed fields: ${disallowed.join(', ')}`, status: 400 };
  }
  const updates = pick(body, ALLOWED_LEAD_FIELDS);

  const currentLead = await leadRepository.findById(leadId);
  if (!currentLead) return { error: 'Lead not found', status: 404 };

  if (updates.assignedRepId !== undefined && updates.assignedRepId !== null && updates.assignedRepId !== '') {
    updates.assignedRepId = String(updates.assignedRepId);
  }

  const contactPrep = prepareLeadContactUpdates(updates, currentLead);
  if (contactPrep) return contactPrep;

  if (!updates.phone && isCorruptLeadPhone(currentLead.phone)) {
    const repairedStored = repairPhone(currentLead.phone);
    if (repairedStored && isValidPhone(repairedStored)) {
      updates.phone = repairedStored;
    }
  }
  const validation = validateLeadInput(updates);
  if (validation) return validation;

  if (Object.keys(updates).length === 0) {
    if (bodyKeys.length > 0) {
      return { error: 'No valid fields to update', status: 400 };
    }
    return { lead: currentLead };
  }

  if (updates.phone) {
    const variants = phoneLookupVariants(updates.phone);
    const phoneDup = await Lead.findOne({
      _id: { $ne: leadId },
      tenantId: currentLead.tenantId,
      phone: { $in: variants },
    }).setOptions(TENANT_SAFE_LOOKUP).lean();
    if (phoneDup) {
      const cleared = await clearBlockingDuplicateLead(phoneDup);
      if (!cleared) {
        const extracted = repairPhone(currentLead.phone);
        if (isCorruptLeadPhone(currentLead.phone) && extracted === updates.phone) {
          const merged = await mergeCorruptLeadIntoKeeper(phoneDup._id, currentLead.toObject(), updates);
          if (merged) {
            broadcastRealtimeEvent('leads', 'lead_change', { leadId: phoneDup._id, action: 'update' });
            return { lead: merged };
          }
        }
        return { error: 'A lead with this phone number already exists', status: 409 };
      }
    }
  }

  if (updates.email) {
    const emailDup = await Lead.findOne({
      _id: { $ne: leadId },
      tenantId: currentLead.tenantId,
      email: updates.email,
    }).setOptions(TENANT_SAFE_LOOKUP).lean();
    if (emailDup) {
      const cleared = await clearBlockingDuplicateLead(emailDup);
      if (!cleared) {
        return { error: 'A lead with this email already exists', status: 409 };
      }
    }
  }

  const wasFirstCall = (!currentLead.callStatus || currentLead.callStatus === 'Pending')
    && updates.callStatus
    && updates.callStatus !== 'Pending';

  const followupPatch = {};
  if (updates.nextFollowupDate !== undefined || updates.nextFollowupTime !== undefined) {
    const dateChanged = updates.nextFollowupDate !== undefined
      && updates.nextFollowupDate !== currentLead.nextFollowupDate;
    const timeChanged = updates.nextFollowupTime !== undefined
      && updates.nextFollowupTime !== currentLead.nextFollowupTime;
    if (dateChanged || timeChanged) {
      followupPatch.reminderSent = false;
      followupPatch.notifiedOverdue = false;
    }
  }

  const lead = await Lead.findByIdAndUpdate(leadId, {
    ...updates,
    ...followupPatch,
    lockedBy: user._id.toString(),
    lockedAt: new Date(),
  }, {
    new: true,
    userId: user._id,
    userRole: getDepartmentSlug(user),
  });

  if (!lead) return { error: 'Lead not found', status: 404 };

  if (wasFirstCall && lead.phone && lead.email) {
    try {
      await sendFirstCallNotifications(lead);
    } catch (notificationErr) {
      console.error('Error sending first call notifications:', notificationErr);
    }
  }

  broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'update' });
  return { lead };
}

async function deleteLead(user, leadId, queryParams = {}) {
  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    return { error: 'Invalid lead id', status: 400 };
  }

  const query = { _id: new mongoose.Types.ObjectId(leadId) };
  applyCrmScopeToQuery(query, user, queryParams, {
    restrictToOwnLeads: shouldRestrictCrmMutationsToOwn(user),
  });

  const lead = await Lead.findOne(query).lean();
  if (!lead) return { error: 'Lead not found', status: 404 };

  await auditService.logLeadDeletion(lead, user._id);
  await Lead.findOneAndDelete({ _id: lead._id });
  return { message: `Lead "${lead.name}" permanently deleted.` };
}

async function addNote(user, leadId, text) {
  if (!text || !text.trim()) return { error: 'Note text is required', status: 400 };

  const lead = await Lead.findByIdAndUpdate(leadId, {
    $push: {
      notes: {
        text: text.trim(),
        author: user.name || user.email,
        date: new Date(),
      },
    },
  }, { new: true });

  await auditService.logNoteAdded(leadId, user, text);
  broadcastRealtimeEvent('leads', 'lead_change', { leadId: lead._id, action: 'update' });
  return { lead };
}

async function resetCRM(user, reason) {
  await Lead.deleteMany({});
  await EMI.deleteMany({});
  await CRMImport.deleteMany({});
  await auditService.logSystemReset(user, reason);
  return { message: 'CRM ecosystem successfully purged.' };
}

async function getEmis(leadId) {
  return EMI.find({ leadId }).sort('installmentNo').lean();
}

async function createEmi(leadId, body) {
  const emiData = { ...pick(body, ALLOWED_EMI_FIELDS), leadId };
  const emi = await EMI.create(emiData);
  return { emi, status: 201 };
}

async function updateEmi(emiId, body) {
  const updates = pick(body, ALLOWED_EMI_FIELDS);
  const emi = await EMI.findByIdAndUpdate(emiId, updates, { new: true });
  return { emi };
}

async function cleanupTestData() {
  const { purgeQaTestData } = require('../../../services/qa/qaTestData');
  const { repairCorruptLeadPhones } = require('../../../services/leadPhoneRepair');
  const [swept, phoneRepair] = await Promise.all([
    purgeQaTestData(),
    repairCorruptLeadPhones(),
  ]);
  return {
    message: `Purged ${swept.deleted.tasks} tasks, ${swept.deleted.users} QA probe users, ${swept.deleted.contacts} contacts, ${swept.deleted.leads} leads, and related QA records. Repaired ${phoneRepair.repaired} corrupt phones, deleted ${phoneRepair.deleted} redundant duplicates.`,
    deleted: swept.deleted,
    phoneRepair,
  };
}

module.exports = {
  ALLOWED_EMI_FIELDS,
  createLead,
  updateLead,
  deleteLead,
  addNote,
  resetCRM,
  getEmis,
  createEmi,
  updateEmi,
  cleanupTestData,
};
