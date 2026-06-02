const Lead = require('../models/Lead');
const backgroundQueue = require('./backgroundQueue');
const followupCache = require('./followupCache');
const ContactService = require('./ContactService');
const { parse } = require('date-fns');
const { sanitizeName, sanitizeEmail, normalizePhone, validateDate, sanitizeLocation } = require('../utils/sanitizer');
const { normalizeAndValidateLeadFields } = require('../utils/leadValidation');
const { broadcastRealtimeEvent } = require('../config/realtime');
const { isBookedCallSource } = require('../../shared/dataInlets');

class LeadService {
  async createLead(rawLeadData) {
    const sanitizedData = this.sanitizeAndNormalize(rawLeadData);
    const errors = normalizeAndValidateLeadFields(sanitizedData, { requireName: true, requirePhone: true });
    if (errors.length) {
      const err = new Error(errors[0]);
      err.statusCode = 400;
      throw err;
    }
    const newLead = await Lead.create(sanitizedData);
    
    // Explicit Side-Effects
    await backgroundQueue.queueHolySheetSync(newLead._id);
    await backgroundQueue.queueCsvBackup();
    await followupCache.cacheFollowup(newLead).catch(() => {});
    broadcastRealtimeEvent('leads', 'lead_change', { leadId: newLead._id, action: 'create' });
    await this.syncToContactHub(newLead).catch(() => {});

    return newLead;
  }

  async syncToContactHub(lead) {
    if (!lead) return;
    const inletKey = isBookedCallSource(lead.source) ? 'booked_calls' : 'leads';
    await ContactService.mergeContact({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      leadStatus: lead.leadStatus,
      leadQuality: lead.leadQuality,
      emailStatus: lead.emailStatus,
      unsubscribed: lead.unsubscribed,
      unsubscribeReason: lead.unsubscribeReason,
      recordId: lead._id,
      summary: {
        source: lead.source,
        leadStatus: lead.leadStatus,
        callStatus: lead.callStatus,
        nextFollowupDate: lead.nextFollowupDate,
        nextFollowupTime: lead.nextFollowupTime,
      },
      inletKey,
    }, inletKey === 'booked_calls' ? 'booked_calls' : 'crm');
  }

  applyFollowupReminderResets(updateData, existingLead) {
    if (!existingLead) return updateData;
    const set = updateData.$set || updateData;
    const dateChanged = set.nextFollowupDate !== undefined
      && set.nextFollowupDate !== existingLead.nextFollowupDate;
    const timeChanged = set.nextFollowupTime !== undefined
      && set.nextFollowupTime !== existingLead.nextFollowupTime;
    if (!dateChanged && !timeChanged) return updateData;

    const patch = { reminderSent: false };
    if (set.nextFollowupDate) {
      try {
        const newDate = parse(set.nextFollowupDate, 'dd-MM-yyyy', new Date());
        const oldDate = existingLead.nextFollowupDate
          ? parse(existingLead.nextFollowupDate, 'dd-MM-yyyy', new Date())
          : null;
        if (!isNaN(newDate.getTime()) && (!oldDate || isNaN(oldDate.getTime()) || newDate >= oldDate)) {
          patch.notifiedOverdue = false;
        }
      } catch (_) {
        patch.notifiedOverdue = false;
      }
    } else {
      patch.notifiedOverdue = false;
    }

    if (updateData.$set) {
      return { ...updateData, $set: { ...updateData.$set, ...patch } };
    }
    return { ...updateData, ...patch };
  }

  async updateLead(query, updateData) {
    const existingLead = await Lead.findOne(query).select('nextFollowupDate nextFollowupTime reminderSent notifiedOverdue');
    const withResets = this.applyFollowupReminderResets(updateData, existingLead);
    const sanitizedUpdate = this.sanitizeAndNormalizeUpdate(withResets);
    const updatedLead = await Lead.findOneAndUpdate(query, sanitizedUpdate, { new: true });
    
    if (updatedLead) {
      await backgroundQueue.queueHolySheetSync(updatedLead._id);
      await backgroundQueue.queueCsvBackup();
      await followupCache.cacheFollowup(updatedLead).catch(() => {});
      broadcastRealtimeEvent('leads', 'lead_change', { leadId: updatedLead._id, action: 'update' });
      await this.syncToContactHub(updatedLead).catch(() => {});
    }

    return updatedLead;
  }

  async upsertLead(query, updateData, session = null) {
    const existingLead = await Lead.findOne(query).select('nextFollowupDate nextFollowupTime reminderSent notifiedOverdue');
    const withResets = this.applyFollowupReminderResets(updateData, existingLead);
    const sanitizedUpdate = this.sanitizeAndNormalizeUpdate(withResets);
    
    // Add $setOnInsert sanitization if present
    if (sanitizedUpdate.$setOnInsert) {
      const cleanOnInsert = this.sanitizeAndNormalize(sanitizedUpdate.$setOnInsert);
      sanitizedUpdate.$setOnInsert = cleanOnInsert;
    }
    
    const options = { upsert: true, new: true, runValidators: true };
    if (session) options.session = session;
    
    const upsertedLead = await Lead.findOneAndUpdate(query, sanitizedUpdate, options);
    
    if (upsertedLead && !session) { // Defer side-effects if using session until commit
      await backgroundQueue.queueHolySheetSync(upsertedLead._id);
      await backgroundQueue.queueCsvBackup();
      await followupCache.cacheFollowup(upsertedLead).catch(() => {});
      await this.syncToContactHub(upsertedLead).catch(() => {});
    }

    return upsertedLead;
  }

  async triggerSideEffects(leadId) {
    if (!leadId) return;
    await backgroundQueue.queueHolySheetSync(leadId);
    await backgroundQueue.queueCsvBackup();
    try {
      const lead = await Lead.findById(leadId);
      if (lead) await followupCache.cacheFollowup(lead);
    } catch(err) {}
  }

  sanitizeAndNormalize(data) {
    const clean = { ...data };
    if (clean.name) clean.name = sanitizeName(clean.name);
    if (clean.email) clean.email = sanitizeEmail(clean.email);
    if (clean.phone) clean.phone = normalizePhone(clean.phone);
    if (clean.city) clean.city = sanitizeLocation(clean.city);
    if (clean.location) clean.location = sanitizeLocation(clean.location);
    if (clean.nextFollowupDate && !validateDate(clean.nextFollowupDate)) {
      clean.nextFollowupDate = '';
    }
    return clean;
  }

  sanitizeAndNormalizeUpdate(update) {
    if (!update) return update;
    const clean = { ...update };
    const set = clean.$set || clean;
    
    if (set.name) set.name = sanitizeName(set.name);
    if (set.email) set.email = sanitizeEmail(set.email);
    if (set.phone) set.phone = normalizePhone(set.phone);
    if (set.city) set.city = sanitizeLocation(set.city);
    if (set.location) set.location = sanitizeLocation(set.location);
    if (set.nextFollowupDate && !validateDate(set.nextFollowupDate)) {
      set.nextFollowupDate = '';
    }
    
    return clean;
  }
}

module.exports = new LeadService();
