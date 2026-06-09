const PersonIndex = require('../models/PersonIndex');
const PersonIdentityService = require('./PersonIdentityService');
const PersonHubBuilder = require('./PersonHubBuilder');
const { sanitizeEmail, sanitizeName, normalizePhone, sanitizeLocation } = require('../utils/sanitizer');
const { normalizePersonRecord } = require('../utils/personNormalization');
const { SOURCE_TO_INLET, dedupeInletEntries } = require('../../shared/dataInlets');

const SOURCE_TYPE_FOR_LINK = {
  crm: 'lead',
  leads: 'lead',
  exly: 'exly_booking',
  mailer: 'mail',
  outsourced: 'outsourced',
  tsc: 'outsourced',
  newsletter: 'newsletter',
  artist_path: 'artist_path',
  artist_crm: 'artist_crm',
  booked_calls: 'booked_call',
  enquiries: 'enquiry',
  community: 'outsourced',
};

class ContactService {
  /**
   * Resolve golden Person, link source, rebuild hub view.
   * Still maintains legacy PersonIndex inlets for backward compatibility during migration.
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
    if (!email && !phone) return null;

    const inletKey = data.inletKey || SOURCE_TO_INLET[source] || source;
    const recordId = data.recordId || null;
    const linkType = SOURCE_TYPE_FOR_LINK[source] || SOURCE_TYPE_FOR_LINK[inletKey] || inletKey;

    const resolved = await PersonIdentityService.resolvePerson(
      { name: normalized.name, email, phone, city: normalized.city || data.city },
      { source: linkType }
    );
    if (!resolved) return null;

    if (data.emailStatus || data.unsubscribed !== undefined) {
      await PersonIdentityService.updateCommunicationProfile(resolved.personId, {
        emailStatus: data.emailStatus,
        unsubscribed: data.unsubscribed,
        unsubscribeReason: data.unsubscribeReason,
      });
    }

    if (recordId) {
      await PersonIdentityService.linkSource(resolved.personId, linkType, recordId, data.summary || {});
    }

    await PersonHubBuilder.rebuildPerson(resolved.personId);

    const legacy = await this._mergeLegacyPersonIndex(data, source, inletKey, recordId, normalized);
    return legacy || { _id: resolved.personId, personId: resolved.personId, ...resolved.person?.toObject?.() };
  }

  async _mergeLegacyPersonIndex(data, source, inletKey, recordId, normalized) {
    const email = normalized.email;
    const phone = normalized.phone;
    const name = normalized.name || 'Anonymous';
    const nameKey = normalized.nameKey;
    const now = new Date();
    const filter = { $or: [] };
    if (email) filter.$or.push({ email });
    if (phone) filter.$or.push({ phone });

    const updatePayload = { $set: {}, $addToSet: {} };
    if (name && name !== 'Anonymous') {
      updatePayload.$set.name = name;
      if (nameKey) updatePayload.$set.nameKey = nameKey;
    }
    if (email) updatePayload.$set.email = email;
    if (phone) updatePayload.$set.phone = phone;
    if (normalized.city) updatePayload.$set.city = normalized.city;
    else if (data.city) updatePayload.$set.city = sanitizeLocation(data.city);

    if (source === 'crm' || inletKey === 'leads') updatePayload.$set.inCRM = true;
    else if (source === 'exly' || inletKey === 'exly') updatePayload.$set.inExly = true;
    else if (source === 'mailer' || inletKey === 'mail') updatePayload.$set.inMailer = true;
    else if (inletKey === 'outsourced' || inletKey === 'tsc') updatePayload.$set.inOutsourced = true;
    else if (inletKey === 'newsletter') updatePayload.$set.inNewsletter = true;
    else if (inletKey === 'artist_path') updatePayload.$set.inArtistPath = true;
    else if (inletKey === 'artist_crm') updatePayload.$set.inArtistCrm = true;
    else if (inletKey === 'booked_calls') {
      updatePayload.$set.inBookedCalls = true;
      updatePayload.$set.inCRM = true;
    } else if (inletKey === 'enquiries') updatePayload.$set.inEnquiries = true;
    else if (inletKey === 'community') updatePayload.$set.inCommunity = true;

    if (Object.keys(updatePayload.$addToSet).length === 0) delete updatePayload.$addToSet;

    const contact = await PersonIndex.findOneAndUpdate(filter, updatePayload, { upsert: true, new: true, runValidators: true });
    if (inletKey && inletKey !== 'all' && inletKey !== 'loyal') {
      const normalizedInlet = inletKey === 'tsc' ? 'outsourced' : inletKey;
      await this._upsertInletEntry(contact._id, normalizedInlet, recordId, data.summary || {}, now);
    }
    return PersonIndex.findById(contact._id);
  }

  async _upsertInletEntry(contactId, inletKey, recordId, summary, now) {
    const contact = await PersonIndex.findById(contactId);
    if (!contact) return;
    const idx = (contact.inlets || []).findIndex((i) => i.key === inletKey);
    if (idx >= 0) {
      const entry = contact.inlets[idx];
      if (recordId) {
        const ids = entry.recordIds.map(String);
        if (!ids.includes(String(recordId))) entry.recordIds.push(recordId);
      }
      entry.lastSeenAt = now;
      if (summary && Object.keys(summary).length) entry.summary = { ...(entry.summary || {}), ...summary };
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
    const contact = await PersonIndex.findById(contactId);
    if (!contact) return null;
    contact.inlets = dedupeInletEntries(contact.inlets || []);
    contact.inletCount = contact.inlets.length;
    contact.isMultiInlet = contact.inlets.length >= 2;
    await contact.save();
    return contact;
  }
}

module.exports = new ContactService();
