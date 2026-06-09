const mongoose = require('mongoose');
const Person = require('../models/Person');
const PersonIdentifier = require('../models/PersonIdentifier');
const PersonCommunicationProfile = require('../models/PersonCommunicationProfile');
const PersonSourceLink = require('../models/PersonSourceLink');
const { normalizePersonRecord } = require('../utils/personNormalization');

const BYPASS = { bypassTenant: true };

const SOURCE_TYPE_MAP = {
  crm: 'lead',
  leads: 'lead',
  lead: 'lead',
  exly: 'exly_booking',
  exly_booking: 'exly_booking',
  outsourced: 'outsourced',
  tsc: 'outsourced',
  booked_calls: 'booked_call',
  booked_call: 'booked_call',
  newsletter: 'newsletter',
  artist_path: 'artist_path',
  mail: 'mail',
  mailer: 'mail',
  enquiries: 'enquiry',
  enquiry: 'enquiry',
};

class PersonIdentityService {
  /**
   * Resolve or create golden Person record from email/phone.
   * @returns {Promise<{ personId, person, created: boolean }|null>}
   */
  async resolvePerson(input = {}, options = {}) {
    const { source = 'unknown', emailOnly = false } = options;
    const normalized = normalizePersonRecord(input, { tryRepairPhone: true });
    const email = normalized.email;
    const phone = normalized.phone;
    const name = normalized.name || input.name || 'Anonymous';
    const city = normalized.city || input.city;

    if (!email && !phone) return null;

    const useEmailOnly = emailOnly || source === 'artist_path';
    let personId = null;
    let created = false;

    if (useEmailOnly && email) {
      const emailMatch = await PersonIdentifier.findOne({ type: 'email', valueNormalized: email }).lean();
      if (emailMatch) {
        const emailCount = await PersonIdentifier.countDocuments({
          personId: emailMatch.personId,
          type: 'email',
        });
        if (emailCount > 1) {
          const person = await Person.create({
            canonicalName: name !== 'Anonymous' ? name : email,
            nameKey: normalized.nameKey,
            city: city || undefined,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          });
          personId = person._id;
          created = true;
          await PersonIdentifier.updateOne(
            { type: 'email', valueNormalized: email },
            { $set: { personId: person._id, source } }
          );
        } else {
          personId = emailMatch.personId;
        }
      } else {
        const person = await Person.create({
          canonicalName: name !== 'Anonymous' ? name : email,
          nameKey: normalized.nameKey,
          city: city || undefined,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        });
        personId = person._id;
        created = true;
      }
    } else {
      const identifiers = [];
      if (email) identifiers.push({ type: 'email', value: email });
      if (phone) identifiers.push({ type: 'phone', value: phone });
      personId = await this._findPersonByIdentifiers(identifiers);

      if (!personId) {
        const person = await Person.create({
          canonicalName: name !== 'Anonymous' ? name : (email || phone),
          nameKey: normalized.nameKey,
          city: city || undefined,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        });
        personId = person._id;
        created = true;
      }
    }

    if (!created) {
      await Person.findByIdAndUpdate(personId, {
        $set: {
          ...(name && name !== 'Anonymous' ? { canonicalName: name, nameKey: normalized.nameKey } : {}),
          ...(city ? { city } : {}),
          lastSeenAt: new Date(),
        },
        $inc: { identityVersion: 0 },
      });
    }

    if (email) {
      personId = (await this._upsertIdentifier(personId, 'email', email, source)) || personId;
    }
    if (phone) {
      personId = (await this._attachPhoneIdentifier(personId, phone, source, { allowMerge: !useEmailOnly })) || personId;
    }

    await this._ensureCommunicationProfile(personId);

    const person = await Person.findById(personId);
    return { personId, person, created };
  }

  async _ensureCommunicationProfile(personId) {
    if (!personId) return null;
    try {
      return await PersonCommunicationProfile.findOneAndUpdate(
        { personId },
        { $setOnInsert: { personId } },
        { upsert: true, new: true }
      ).setOptions(BYPASS);
    } catch (err) {
      if (err.code === 11000) {
        return PersonCommunicationProfile.findOne({ personId }).setOptions(BYPASS);
      }
      throw err;
    }
  }

  async _upsertIdentifier(personId, type, value, source) {
    try {
      await PersonIdentifier.findOneAndUpdate(
        { type, valueNormalized: value },
        { $setOnInsert: { personId, type, valueNormalized: value, source } },
        { upsert: true, new: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        const existing = await PersonIdentifier.findOne({ type, valueNormalized: value }).lean();
        if (existing && String(existing.personId) !== String(personId)) {
          return this._mergePersonIds(personId, existing.personId);
        }
      } else {
        throw err;
      }
    }
    return personId;
  }

  async _attachPhoneIdentifier(personId, phone, source, { allowMerge = true } = {}) {
    if (!phone) return personId;
    const existing = await PersonIdentifier.findOne({ type: 'phone', valueNormalized: phone }).lean();
    if (existing && String(existing.personId) !== String(personId)) {
      if (!allowMerge) return personId;
      return this._mergePersonIds(personId, existing.personId);
    }
    return this._upsertIdentifier(personId, 'phone', phone, source);
  }

  async _findPersonByIdentifiers(identifiers) {
    if (!identifiers.length) return null;
    const or = identifiers.map((id) => ({ type: id.type, valueNormalized: id.value }));
    const matches = await PersonIdentifier.find({ $or: or }).lean();
    if (!matches.length) return null;
    const ids = [...new Set(matches.map((m) => String(m.personId)))];
    if (ids.length === 1) return matches[0].personId;
    return this._mergePersonIds(ids[0], ids[1]);
  }

  async _mergePersonIds(primaryId, secondaryId) {
    if (!primaryId || !secondaryId || String(primaryId) === String(secondaryId)) {
      return primaryId || secondaryId;
    }
    const primary = new mongoose.Types.ObjectId(primaryId);
    const secondary = new mongoose.Types.ObjectId(secondaryId);

    await PersonIdentifier.updateMany({ personId: secondary }, { $set: { personId: primary } });
    await PersonSourceLink.updateMany({ personId: secondary }, { $set: { personId: primary } });
    const secondaryComms = await PersonCommunicationProfile.findOne({ personId: secondary }).setOptions(BYPASS).lean();
    if (secondaryComms) {
      await PersonCommunicationProfile.deleteOne({ personId: secondary }).setOptions(BYPASS);
    }
    await Person.deleteOne({ _id: secondary });
    return primary;
  }

  async linkSource(personId, sourceType, sourceId, summary = {}) {
    if (!personId || !sourceId) return null;
    const normalizedType = SOURCE_TYPE_MAP[sourceType] || sourceType;
    const now = new Date();
    return PersonSourceLink.findOneAndUpdate(
      { personId, sourceType: normalizedType, sourceId },
      {
        $set: { lastSeenAt: now, summary: { ...summary } },
        $setOnInsert: { firstSeenAt: now },
      },
      { upsert: true, new: true }
    );
  }

  async getPrimaryEmailPhone(personId) {
    const ids = await PersonIdentifier.find({ personId }).lean();
    return {
      email: ids.find((i) => i.type === 'email')?.valueNormalized || '',
      phone: ids.find((i) => i.type === 'phone')?.valueNormalized || '',
    };
  }

  async updateCommunicationProfile(personId, fields = {}) {
    if (!personId) return null;
    const update = {};
    if (fields.emailStatus) update.emailStatus = fields.emailStatus;
    if (fields.unsubscribed !== undefined) update.unsubscribed = fields.unsubscribed;
    if (fields.unsubscribeReason) update.unsubscribeReason = fields.unsubscribeReason;
    if (fields.bounceCount !== undefined) update.bounceCount = fields.bounceCount;
    if (Object.keys(update).length === 0) return null;
    await this._ensureCommunicationProfile(personId);
    return PersonCommunicationProfile.findOneAndUpdate(
      { personId },
      { $set: update },
      { new: true }
    ).setOptions(BYPASS);
  }
}

module.exports = new PersonIdentityService();
