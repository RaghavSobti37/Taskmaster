const mongoose = require('mongoose');
const Person = require('../models/Person');
const PersonIdentifier = require('../models/PersonIdentifier');
const PersonCommunicationProfile = require('../models/PersonCommunicationProfile');
const PersonSourceLink = require('../models/PersonSourceLink');
const PersonHubView = require('../models/PersonHubView');
const PersonIndex = require('../models/PersonIndex');
const Lead = require('../models/Lead');
const ExlyBooking = require('../models/ExlyBooking');
const OutsourcedRecord = require('../models/OutsourcedRecord');
const BookedCall = require('../models/BookedCall');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const PersonIdentityService = require('./PersonIdentityService');
const { getTenantId } = require('../utils/tenantContext');

const INLET_FLAG_MAP = {
  lead: 'inCRM',
  exly_booking: 'inExly',
  outsourced: 'inOutsourced',
  booked_call: 'inBookedCalls',
  newsletter: 'inNewsletter',
  artist_path: 'inArtistPath',
  artist_crm: 'inArtistCrm',
  mail: 'inMailer',
  enquiry: 'inEnquiries',
};

/** PersonIndex folder keys → hub source types */
const FOLDER_TO_HUB_KEY = {
  leads: 'lead',
  exly: 'exly_booking',
  outsourced: 'outsourced',
  tsc: 'outsourced',
  newsletter: 'newsletter',
  artist_path: 'artist_path',
  artist_crm: 'artist_crm',
  booked_calls: 'booked_call',
  enquiries: 'enquiry',
  mail: 'mail',
  havells_registered: 'havells_registered',
  havells_selected: 'havells_selected',
  havells_attended_delhi: 'havells_attended_delhi',
  havells_attended_indore: 'havells_attended_indore',
  havells_attended_dumka: 'havells_attended_dumka',
};

function inletKeysFromPersonIndex(idx) {
  if (!idx) return [];
  const keys = new Set();
  for (const inlet of idx.inlets || []) {
    const hubKey = FOLDER_TO_HUB_KEY[inlet.key] || inlet.key;
    if (hubKey) keys.add(hubKey);
  }
  if (idx.inCRM) keys.add('lead');
  if (idx.inExly) keys.add('exly_booking');
  if (idx.inMailer) keys.add('mail');
  if (idx.inOutsourced || idx.inTsc) keys.add('outsourced');
  if (idx.inBookedCalls) keys.add('booked_call');
  if (idx.inEnquiries) keys.add('enquiry');
  if (idx.inNewsletter) keys.add('newsletter');
  if (idx.inArtistPath) keys.add('artist_path');
  if (idx.inArtistCrm) keys.add('artist_crm');
  return [...keys];
}

function applyPersonIndexFlags(flags, idx) {
  if (!idx) return flags;
  if (idx.inCRM) flags.inCRM = true;
  if (idx.inExly) flags.inExly = true;
  if (idx.inMailer) flags.inMailer = true;
  if (idx.inOutsourced || idx.inTsc) flags.inOutsourced = true;
  if (idx.inBookedCalls) flags.inBookedCalls = true;
  if (idx.inEnquiries) flags.inEnquiries = true;
  if (idx.inNewsletter) flags.inNewsletter = true;
  if (idx.inArtistPath) flags.inArtistPath = true;
  if (idx.inArtistCrm) flags.inArtistCrm = true;
  if (idx.inCommunity) flags.inCommunity = true;
  if (idx.imlPriority) flags.imlPriority = true;
  return flags;
}

function isLikelyEssayName(value) {
  if (!value || typeof value !== 'string') return false;
  const t = value.trim();
  return t.length > 55 || /^I (AM|WAS|'M)\b/i.test(t) || /^I WANT TO\b/i.test(t);
}

function responseCompleteness(answers = {}) {
  return Object.values(answers || {}).filter((v) => v != null && String(v).trim() !== '').length;
}

function pickBestArtistPathResponse(responses = []) {
  if (!responses.length) return null;
  return [...responses].sort((a, b) => {
    const completenessDelta = responseCompleteness(b.answers) - responseCompleteness(a.answers);
    if (completenessDelta !== 0) return completenessDelta;
    return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
  })[0];
}

async function clearHubIdentityConflicts({ tenantId, personId, email, phone }) {
  if (!tenantId) return;
  const personOid = new mongoose.Types.ObjectId(personId);
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
  if (normalizedEmail) {
    await PersonHubView.collection.updateMany(
      { tenantId, email: normalizedEmail, personId: { $ne: personOid } },
      { $unset: { email: '' } }
    );
  }
  if (normalizedPhone) {
    await PersonHubView.collection.updateMany(
      { tenantId, phone: normalizedPhone, personId: { $ne: personOid } },
      { $unset: { phone: '' } }
    );
  }
}

function resolveHubDisplayName(person, latestArtistPath) {
  const fromAnswers = latestArtistPath?.answers?.name;
  if (fromAnswers && !isLikelyEssayName(fromAnswers)) return fromAnswers;
  if (person.canonicalName && !isLikelyEssayName(person.canonicalName)) return person.canonicalName;
  return fromAnswers || person.canonicalName || 'Respondent';
}

class PersonHubBuilder {
  async _loadPersonIndexFallback(email, phone) {
    const clauses = [];
    if (email) clauses.push({ email });
    if (phone) clauses.push({ phone });
    if (!clauses.length) return null;
    return PersonIndex.findOne({ $or: clauses }).setOptions({ bypassTenant: true }).lean();
  }

  async rebuildPerson(personId) {
    if (!personId) return null;
    const person = await Person.findById(personId).lean();
    if (!person) return null;
    const tenantId = getTenantId() || person.tenantId;

    const [identifiers, comms, links, artistPathResponses] = await Promise.all([
      PersonIdentifier.find({ personId }).lean(),
      PersonCommunicationProfile.findOne({ personId }).lean(),
      PersonSourceLink.find({ personId }).lean(),
      ArtistPathResponse.find({ personId }).setOptions({ bypassTenant: true }).lean(),
    ]);
    const imlPriority = links.some((link) => {
      if (link.sourceType !== 'exly_booking') return false;
      const text = `${link.summary?.offeringTitle || ''} ${link.summary?.offering || ''}`;
      return /\biml\b|i\.?m\.?l/i.test(String(text));
    });

    const artistPathCount = artistPathResponses.length;
    const latestArtistPath = pickBestArtistPathResponse(artistPathResponses);

    const identifierEmails = identifiers
      .filter((i) => i.type === 'email')
      .map((i) => i.valueNormalized)
      .filter(Boolean);
    const responseEmail = latestArtistPath?.answers?.email?.toLowerCase();
    let email = (responseEmail && identifierEmails.includes(responseEmail) ? responseEmail : null)
      || identifierEmails[0]
      || responseEmail
      || '';
    const identifierPhones = identifiers
      .filter((i) => i.type === 'phone')
      .map((i) => i.valueNormalized)
      .filter(Boolean);
    const responsePhone = latestArtistPath?.answers?.phone;
    let phone = (responsePhone && identifierPhones.includes(responsePhone) ? responsePhone : null)
      || identifierPhones[0]
      || responsePhone
      || '';

    if (email) {
      const emailOwner = await PersonHubView.findOne({
        email,
        personId: { $ne: personId },
        ...(tenantId ? { tenantId } : {}),
      })
        .setOptions({ bypassTenant: true })
        .select('personId')
        .lean();
      if (emailOwner) {
        email = identifierEmails.find((e) => e !== responseEmail) || identifierEmails[0] || email;
      }
    }

    const legacyIndex = await this._loadPersonIndexFallback(email, phone);

    let inletKeys = [...new Set(links.map((l) => l.sourceType))];
    for (const hubKey of inletKeysFromPersonIndex(legacyIndex)) {
      if (!inletKeys.includes(hubKey)) inletKeys.push(hubKey);
    }

    const flags = applyPersonIndexFlags({}, legacyIndex);
    for (const key of inletKeys) {
      const flag = INLET_FLAG_MAP[key];
      if (flag) flags[flag] = true;
    }

    const lastActivityAt = links.reduce((max, l) => {
      const t = l.lastSeenAt || l.createdAt;
      return t && new Date(t) > max ? new Date(t) : max;
    }, person.lastSeenAt || new Date());

    const hubDoc = {
      personId,
      name: resolveHubDisplayName(person, latestArtistPath) !== 'Respondent'
        ? resolveHubDisplayName(person, latestArtistPath)
        : (legacyIndex?.name && !isLikelyEssayName(legacyIndex.name) ? legacyIndex.name : resolveHubDisplayName(person, latestArtistPath)),
      city: person.city || latestArtistPath?.answers?.city || legacyIndex?.city,
      inletKeys,
      inletCount: inletKeys.length,
      isMultiInlet: inletKeys.length >= 2,
      emailStatus: comms?.emailStatus || legacyIndex?.emailStatus || 'Pending',
      unsubscribed: comms?.unsubscribed ?? legacyIndex?.unsubscribed ?? false,
      firstSeenAt: person.firstSeenAt || legacyIndex?.createdAt || new Date(),
      lastActivityAt,
      inArtistPath: artistPathCount > 0,
      latestArtistType: latestArtistPath?.answers?.stageName
        || latestArtistPath?.answers?.artistType
        || undefined,
      artistPathResponseCount: artistPathCount,
      imlPriority: imlPriority || Boolean(legacyIndex?.imlPriority),
      ...flags,
    };
    if (email) hubDoc.email = email;
    if (phone) hubDoc.phone = phone;

    const payload = { ...hubDoc, updatedAt: new Date() };
    if (!email) delete payload.email;
    if (!phone) delete payload.phone;
    if (tenantId) payload.tenantId = tenantId;

    await clearHubIdentityConflicts({ tenantId, personId, email, phone });

    const updateOp = {
      $set: payload,
      $setOnInsert: { createdAt: new Date() },
    };
    const unsetFields = {};
    if (!email) unsetFields.email = '';
    if (!phone) unsetFields.phone = '';
    if (Object.keys(unsetFields).length) updateOp.$unset = unsetFields;

    await PersonHubView.collection.updateOne(
      { personId: new mongoose.Types.ObjectId(personId) },
      updateOp,
      { upsert: true }
    );

    return PersonHubView.findOne({ personId }).setOptions({ bypassTenant: true });
  }

  async rebuildAll({ onProgress, batchSize = 100 } = {}) {
    const total = await Person.countDocuments();
    let processed = 0;
    let cursor = Person.find({}).cursor();

    for await (const person of cursor) {
      await this.rebuildPerson(person._id);
      processed++;
      if (onProgress && processed % batchSize === 0) {
        onProgress(`rebuilt ${processed}/${total}`);
      }
    }
    return { processed, total };
  }

  async rebuildFromPersonIndex({ embedded = false, batchSize = 200, onProgress, filter = null } = {}) {
    const query = filter && typeof filter === 'object' ? filter : {};
    let count = 0;
    let processed = 0;
    const cursor = PersonIndex.find(query).lean().cursor();
    for await (const row of cursor) {
      processed += 1;
      const resolved = await PersonIdentityService.resolvePerson({
        name: row.name,
        email: row.email,
        phone: row.phone,
        city: row.city,
      }, { source: 'personindex_migration' });
      if (!resolved) continue;
      count += 1;
      await this.rebuildPerson(resolved.personId);
      if (onProgress && processed % batchSize === 0) {
        onProgress(`rebuilt ${count}/${processed} indexed rows`);
      }
    }
    return { migrated: count, processed };
  }

  async _syncPersonIndexRow(row) {
    const inletKeys = inletKeysFromPersonIndex(row);
    if (!inletKeys.length) return { status: 'skipped' };

    const identityClauses = [];
    if (row.email) identityClauses.push({ email: row.email });
    if (row.phone) identityClauses.push({ phone: row.phone });

    let existing = null;
    if (identityClauses.length) {
      existing = await PersonHubView.findOne({ $or: identityClauses })
        .setOptions({ bypassTenant: true })
        .select('personId inletKeys email phone')
        .lean();
    }

    let personId = existing?.personId || null;
    if (!personId) {
      let resolved = null;
      try {
        resolved = await PersonIdentityService.resolvePerson({
          name: row.name,
          email: row.email,
          phone: row.phone,
          city: row.city,
        }, { source: 'personindex_inlet_sync' });
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
      if (!resolved?.personId && row.email) {
        const emailMatch = await PersonIdentifier.findOne({
          type: 'email',
          valueNormalized: String(row.email).trim().toLowerCase(),
        }).setOptions({ bypassTenant: true }).lean();
        if (emailMatch?.personId) resolved = { personId: emailMatch.personId };
      }
      if (!resolved?.personId && row.phone) {
        const phoneMatch = await PersonIdentifier.findOne({
          type: 'phone',
          valueNormalized: row.phone,
        }).setOptions({ bypassTenant: true }).lean();
        if (phoneMatch?.personId) resolved = { personId: phoneMatch.personId };
      }
      personId = resolved?.personId || null;
    }

    if (!personId) return { status: 'unmatched' };

    if (!existing) {
      existing = await PersonHubView.findOne({ personId })
        .setOptions({ bypassTenant: true })
        .select('inletKeys email phone')
        .lean();
    }

    const mergedKeys = [...new Set([...(existing?.inletKeys || []), ...inletKeys])];
    const flags = applyPersonIndexFlags({}, row);
    const tenantId = getTenantId() || row.tenantId;
    const tenantOid = tenantId ? new mongoose.Types.ObjectId(tenantId) : null;
    const payload = {
      personId,
      name: row.name || 'Unknown',
      city: row.city,
      inletKeys: mergedKeys,
      inletCount: mergedKeys.length,
      isMultiInlet: mergedKeys.length >= 2,
      emailStatus: row.emailStatus || 'Pending',
      unsubscribed: row.unsubscribed ?? false,
      lastActivityAt: row.lastActivityAt || row.updatedAt || new Date(),
      firstSeenAt: row.createdAt || new Date(),
      ...flags,
      updatedAt: new Date(),
    };
    if (row.email) {
      payload.email = row.email;
    } else if (existing?.email) {
      payload.email = existing.email;
    } else {
      payload.email = `__no_email__${String(personId)}@personhub.local`;
    }
    if (row.phone) payload.phone = row.phone;
    else if (existing?.phone) payload.phone = existing.phone;
    if (tenantOid) payload.tenantId = tenantOid;

    const updateOp = {
      $set: payload,
      $setOnInsert: { createdAt: new Date() },
    };

    const result = await PersonHubView.collection.updateOne(
      { personId: new mongoose.Types.ObjectId(personId) },
      updateOp,
      { upsert: true }
    );

    if (result.upsertedCount) return { status: 'created' };
    if (mergedKeys.length !== (existing?.inletKeys || []).length) return { status: 'updated' };
    return { status: 'unchanged' };
  }

  /**
   * Lighter sync: merge PersonIndex inlet keys onto hub rows via personId (no identity conflict pass).
   */
  async syncInletKeysFromPersonIndex({ batchSize = 200, onProgress, filter = null } = {}) {
    const query = filter && typeof filter === 'object' ? filter : {};
    let matched = 0;
    let updated = 0;
    let created = 0;
    let processed = 0;
    let skipped = 0;

    const cursor = PersonIndex.find(query).lean().cursor();
    for await (const row of cursor) {
      processed += 1;
      try {
        const outcome = await this._syncPersonIndexRow(row);
        if (outcome.status === 'created') {
          matched += 1;
          created += 1;
        } else if (outcome.status === 'updated') {
          matched += 1;
          updated += 1;
        } else if (outcome.status === 'unchanged') {
          matched += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        if (error?.code !== 11000) throw error;
        skipped += 1;
      }

      if (onProgress && processed % batchSize === 0) {
        onProgress(`synced ${processed} rows (${matched} matched)`);
      }
    }

    return { processed, matched, updated, created, skipped };
  }
}

module.exports = new PersonHubBuilder();
