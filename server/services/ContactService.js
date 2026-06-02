const Contact = require('../models/Contact');
const { sanitizeEmail, sanitizeName, normalizePhone, sanitizeLocation } = require('../utils/sanitizer');
const { normalizePersonRecord } = require('../utils/personNormalization');
const { SOURCE_TO_INLET, dedupeInletEntries } = require('../../shared/dataInlets');

class ContactService {
  /**
   * Upserts a contact combining data from different sources to ensure no duplicates.
   * @param {Object} data - Person fields + optional inletKey, recordId, summary
   * @param {string} source - Legacy source: crm | exly | mailer | tsc | booked_calls | enquiries
   */
  async mergeContact(data, source = 'crm') {
    const normalized = normalizePersonRecord(
      {
        name: sanitizeName(data.name) || data.name || 'Anonymous',
        email: sanitizeEmail(data.email) || data.email,
        phone: normalizePhone(data.phone) || data.phone,
        city: data.city,
      },
      { tryRepairPhone: true }
    );
    const email = normalized.email;
    const phone = normalized.phone;
    const name = normalized.name || 'Anonymous';
    const nameKey = normalized.nameKey;

    if (!email && !phone) return null;

    const inletKey = data.inletKey || SOURCE_TO_INLET[source] || source;
    const recordId = data.recordId || null;
    const now = new Date();

    const filter = { $or: [] };
    if (email) filter.$or.push({ email });
    if (phone) filter.$or.push({ phone });

    let existing = await Contact.findOne(filter).lean();

    const updatePayload = {
      $set: {},
      $addToSet: {},
    };

    if (name && name !== 'Anonymous') {
      updatePayload.$set.name = name;
      if (nameKey) updatePayload.$set.nameKey = nameKey;
    }
    if (email) updatePayload.$set.email = email;
    if (phone) updatePayload.$set.phone = phone;
    if (normalized.city) updatePayload.$set.city = normalized.city;
    else if (data.city) updatePayload.$set.city = sanitizeLocation(data.city);
    if (data.sourceFilename) updatePayload.$set.sourceFilename = data.sourceFilename;
    if (data.emailStatus) updatePayload.$set.emailStatus = data.emailStatus;
    if (data.unsubscribed !== undefined) updatePayload.$set.unsubscribed = data.unsubscribed;
    if (data.unsubscribeReason) updatePayload.$set.unsubscribeReason = data.unsubscribeReason;

    if (source === 'crm' || inletKey === 'leads') {
      updatePayload.$set.inCRM = true;
      if (data.leadStatus) updatePayload.$set.leadStatus = data.leadStatus;
      if (data.leadQuality) updatePayload.$set.leadQuality = data.leadQuality;
    } else if (source === 'exly' || inletKey === 'exly') {
      updatePayload.$set.inExly = true;
      if (data.exlyOfferingTitle) {
        updatePayload.$addToSet.exlyOfferings = data.exlyOfferingTitle;
      }
    } else if (source === 'mailer' || inletKey === 'mail') {
      updatePayload.$set.inMailer = true;
      if (data.emailStatus) updatePayload.$set.emailStatus = data.emailStatus;
    } else if (inletKey === 'tsc') {
      updatePayload.$set.inTsc = true;
    } else if (inletKey === 'booked_calls') {
      updatePayload.$set.inBookedCalls = true;
      updatePayload.$set.inCRM = true;
    } else if (inletKey === 'enquiries') {
      updatePayload.$set.inEnquiries = true;
    } else if (inletKey === 'community') {
      updatePayload.$set.inCommunity = true;
    }

    if (Object.keys(updatePayload.$addToSet).length === 0) {
      delete updatePayload.$addToSet;
    }

    const contact = await Contact.findOneAndUpdate(
      filter,
      updatePayload,
      { upsert: true, new: true, runValidators: true }
    );

    if (inletKey && inletKey !== 'all' && inletKey !== 'loyal') {
      await this._upsertInletEntry(contact._id, inletKey, recordId, data.summary || {}, now);
    }

    return await Contact.findById(contact._id);
  }

  async _upsertInletEntry(contactId, inletKey, recordId, summary, now) {
    const contact = await Contact.findById(contactId);
    if (!contact) return;

    const idx = (contact.inlets || []).findIndex((i) => i.key === inletKey);
    if (idx >= 0) {
      const entry = contact.inlets[idx];
      if (recordId) {
        const ids = entry.recordIds.map(String);
        if (!ids.includes(String(recordId))) {
          entry.recordIds.push(recordId);
        }
      }
      entry.lastSeenAt = now;
      if (summary && Object.keys(summary).length) {
        entry.summary = { ...(entry.summary || {}), ...summary };
      }
      contact.inlets[idx] = entry;
    } else {
      contact.inlets.push({
        key: inletKey,
        recordIds: recordId ? [recordId] : [],
        firstSeenAt: now,
        lastSeenAt: now,
        summary: summary || {},
      });
    }

    contact.inlets = dedupeInletEntries(contact.inlets || []);
    contact.inletCount = contact.inlets.length;
    contact.isMultiInlet = contact.inlets.length >= 2;
    await contact.save();
  }

  async recomputeInletCounts(contactId) {
    const contact = await Contact.findById(contactId);
    if (!contact) return null;
    contact.inlets = dedupeInletEntries(contact.inlets || []);
    contact.inletCount = contact.inlets.length;
    contact.isMultiInlet = contact.inlets.length >= 2;
    await contact.save();
    return contact;
  }
}

module.exports = new ContactService();
