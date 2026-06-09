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

const INLET_FLAG_MAP = {
  lead: 'inCRM',
  exly_booking: 'inExly',
  outsourced: 'inOutsourced',
  booked_call: 'inBookedCalls',
  newsletter: 'inNewsletter',
  artist_path: 'inArtistPath',
  mail: 'inMailer',
  enquiry: 'inEnquiries',
};

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

function resolveHubDisplayName(person, latestArtistPath) {
  const fromAnswers = latestArtistPath?.answers?.name;
  if (fromAnswers && !isLikelyEssayName(fromAnswers)) return fromAnswers;
  if (person.canonicalName && !isLikelyEssayName(person.canonicalName)) return person.canonicalName;
  return fromAnswers || person.canonicalName || 'Respondent';
}

class PersonHubBuilder {
  async rebuildPerson(personId) {
    if (!personId) return null;
    const person = await Person.findById(personId).lean();
    if (!person) return null;

    const [identifiers, comms, links, artistPathResponses] = await Promise.all([
      PersonIdentifier.find({ personId }).lean(),
      PersonCommunicationProfile.findOne({ personId }).lean(),
      PersonSourceLink.find({ personId }).lean(),
      ArtistPathResponse.find({ personId }).setOptions({ bypassTenant: true }).lean(),
    ]);

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
      const emailOwner = await PersonHubView.findOne({ email, personId: { $ne: personId } })
        .setOptions({ bypassTenant: true })
        .select('personId')
        .lean();
      if (emailOwner) {
        email = identifierEmails.find((e) => e !== responseEmail) || identifierEmails[0] || email;
      }
    }
    const inletKeys = [...new Set(links.map((l) => l.sourceType))];
    const flags = {};
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
      name: resolveHubDisplayName(person, latestArtistPath),
      city: person.city || latestArtistPath?.answers?.city,
      inletKeys,
      inletCount: inletKeys.length,
      isMultiInlet: inletKeys.length >= 2,
      emailStatus: comms?.emailStatus || 'Pending',
      unsubscribed: comms?.unsubscribed || false,
      lastActivityAt,
      inArtistPath: artistPathCount > 0,
      latestArtistType: latestArtistPath?.answers?.stageName
        || latestArtistPath?.answers?.artistType
        || undefined,
      artistPathResponseCount: artistPathCount,
      ...flags,
    };
    if (email) hubDoc.email = email;
    if (phone) hubDoc.phone = phone;

    const payload = { ...hubDoc, updatedAt: new Date() };
    if (!email) delete payload.email;
    if (!phone) delete payload.phone;

    await PersonHubView.collection.updateOne(
      { personId: new mongoose.Types.ObjectId(personId) },
      {
        $set: payload,
        $setOnInsert: { createdAt: new Date() },
      },
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

  async rebuildFromPersonIndex({ embedded = false } = {}) {
    const indices = await PersonIndex.find({}).lean();
    let count = 0;
    for (const row of indices) {
      const resolved = await PersonIdentityService.resolvePerson({
        name: row.name,
        email: row.email,
        phone: row.phone,
        city: row.city,
      }, { source: 'personindex_migration' });
      if (!resolved) continue;
      count++;
      await this.rebuildPerson(resolved.personId);
    }
    return { migrated: count };
  }
}

module.exports = new PersonHubBuilder();
