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

class PersonHubBuilder {
  async rebuildPerson(personId) {
    if (!personId) return null;
    const person = await Person.findById(personId).lean();
    if (!person) return null;

    const [identifiers, comms, links, artistPathCount, latestArtistPath] = await Promise.all([
      PersonIdentifier.find({ personId }).lean(),
      PersonCommunicationProfile.findOne({ personId }).lean(),
      PersonSourceLink.find({ personId }).lean(),
      ArtistPathResponse.countDocuments({ personId }),
      ArtistPathResponse.findOne({ personId }).sort({ submittedAt: -1 }).lean(),
    ]);

    const email = identifiers.find((i) => i.type === 'email')?.valueNormalized || '';
    const phone = identifiers.find((i) => i.type === 'phone')?.valueNormalized || '';
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
      name: person.canonicalName,
      email: email || undefined,
      phone: phone || undefined,
      city: person.city,
      inletKeys,
      inletCount: inletKeys.length,
      isMultiInlet: inletKeys.length >= 2,
      emailStatus: comms?.emailStatus || 'Pending',
      unsubscribed: comms?.unsubscribed || false,
      lastActivityAt,
      inArtistPath: inletKeys.includes('artist_path') || artistPathCount > 0,
      latestArtistType: latestArtistPath?.answers?.stageName
        || latestArtistPath?.answers?.artistType
        || latestArtistPath?.answers?.artistIdentity?.slice?.(0, 48),
      artistPathResponseCount: artistPathCount,
      ...flags,
    };

    return PersonHubView.findOneAndUpdate(
      { personId },
      { $set: hubDoc },
      { upsert: true, new: true }
    );
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
