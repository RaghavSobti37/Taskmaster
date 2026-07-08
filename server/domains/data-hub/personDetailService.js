const PersonIndex = require('../../models/PersonIndex');
const PersonHubView = require('../../models/PersonHubView');
const Lead = require('../../models/Lead');
const ExlyBooking = require('../../models/ExlyBooking');
const Task = require('../tasks/models/Task');
const { findByEmail: findMailEventsByEmail } = require('../mail/services/mailEventQueryService');
const { dedupeInletEntries } = require('../../../shared/dataInlets');
const {
  CONTACT_BYPASS,
  resolveHubModel,
  isHubViewActive,
} = require('./folderCache');
const {
  identityMatch,
  mapHubRow,
  escapeRegExp,
  parseEnquiryDescription,
} = require('./queryHelpers');
const { loadFragmentedSources } = require('./syncService');
const { SECTION_LOADERS } = require('./processors');
const { listOutcomesForPerson } = require('../../services/aisensyCampaignSyncService');
const { filterEnquiriesForContact } = require('./processors/enquiryMatch');
const {
  crmInletProcessor,
  exlyInletProcessor,
  bookedCallsInletProcessor,
  artistPathInletProcessor,
} = require('./processors');

async function findHubContact(contactId) {
  if (!contactId) return null;
  const HubModel = await resolveHubModel();
  if (isHubViewActive()) {
    let contact = await PersonHubView.findOne({ personId: contactId }).setOptions(CONTACT_BYPASS).lean();
    if (!contact) contact = await PersonHubView.findById(contactId).setOptions(CONTACT_BYPASS).lean();
    return contact ? mapHubRow(contact) : null;
  }
  const contact = await PersonIndex.findById(contactId).setOptions(CONTACT_BYPASS).lean();
  return contact ? mapHubRow(contact) : null;
}

async function getPersonBase(contactId) {
  const contact = await findHubContact(contactId);
  if (!contact) return null;
  contact.inlets = dedupeInletEntries(contact.inlets || []);
  return {
    contact,
    overview: {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      city: contact.city,
      inletCount: contact.inletCount,
      isMultiInlet: contact.isMultiInlet,
      inlets: contact.inlets || [],
      emailStatus: contact.emailStatus,
      unsubscribed: contact.unsubscribed,
      firstSeen: contact.createdAt,
      lastSeen: contact.updatedAt,
      exlyRevenue: 0,
    },
  };
}

async function getPersonSection(contactId, section) {
  const contact = await findHubContact(contactId);
  if (!contact) return null;
  const match = identityMatch(contact.email, contact.phone);
  if (!match) {
    return { section, contact, overview: { inlets: contact.inlets || [] } };
  }

  const loader = SECTION_LOADERS[section];
  if (loader) {
    if (section === 'enquiries' || section === 'mail') {
      return loader(contact);
    }
    return loader(match);
  }

  if (section === 'timeline') {
    const [leads, fragmented, exlyBookings, enquiryTasks, mailEvents] = await Promise.all([
      Lead.find(match).sort({ updatedAt: -1 }).lean(),
      loadFragmentedSources(match),
      ExlyBooking.find(match).sort({ bookedOn: -1 }).lean(),
      Task.find({ type: 'enquiry' }).sort({ createdAt: -1 }).limit(200).lean(),
      contact.email
        ? findMailEventsByEmail(contact.email)
        : [],
    ]);
    const { outsourced, bookedCalls: bookedCallRecords, newsletter } = fragmented;
    const filteredEnquiries = filterEnquiriesForContact(enquiryTasks, contact);
    const timeline = buildTimeline({
      leads,
      outsourced,
      bookedCallRecords,
      newsletter,
      exlyBookings,
      filteredEnquiries,
      mailEvents,
    });
    return { section, timeline };
  }

  if (section === 'overview') {
    const bookings = await ExlyBooking.find(match).select('pricePaid bookedOn').lean();
    const exlyRevenue = exlyInletProcessor.sumExlyRevenue(bookings);
    const crmCount = await Lead.countDocuments(match);
    const exlyCount = bookings.length;
    return {
      section,
      overview: {
        exlyRevenue,
        crmLeadCount: crmCount,
        exlyBookingCount: exlyCount,
      },
    };
  }

  return { section, data: null };
}

async function getPerson360(contactId) {
  const contact = await findHubContact(contactId);
  if (!contact) return null;
  contact.inlets = dedupeInletEntries(contact.inlets || []);

  const match = identityMatch(contact.email, contact.phone);
  if (!match) return { contact, overview: contact };

  const [leads, fragmented, exlyBookings, enquiryTasks, mailEvents] = await Promise.all([
    Lead.find(match).sort({ updatedAt: -1 }).lean(),
    loadFragmentedSources(match),
    ExlyBooking.find(match).sort({ bookedOn: -1 }).lean(),
    Task.find({ type: 'enquiry' }).sort({ createdAt: -1 }).limit(200).lean(),
    contact.email
      ? findMailEventsByEmail(contact.email)
      : [],
  ]);
  const { outsourced, bookedCalls: bookedCallRecords, newsletter } = fragmented;
  const filteredEnquiries = filterEnquiriesForContact(enquiryTasks, contact);

  const [crmSection, exlySection, bookedSection, artistPathSection, whatsappOutcomes] = await Promise.all([
    crmInletProcessor.loadCrmSection(match),
    exlyInletProcessor.loadExlySection(match),
    bookedCallsInletProcessor.loadBookedCallsSection(match),
    artistPathInletProcessor.loadArtistPathSection(contact),
    listOutcomesForPerson({
      personIndexId: contact._id || contact.personId,
      phone: contact.phone,
      email: contact.email,
    }),
  ]);

  const timeline = buildTimeline({
    leads,
    outsourced,
    bookedCallRecords,
    newsletter,
    exlyBookings,
    filteredEnquiries,
    mailEvents,
  });

  const exlyRevenue = exlyInletProcessor.sumExlyRevenue(exlyBookings);

  return {
    contact,
    overview: {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      city: contact.city,
      inletCount: contact.inletCount,
      isMultiInlet: contact.isMultiInlet,
      inlets: contact.inlets || [],
      emailStatus: contact.emailStatus,
      unsubscribed: contact.unsubscribed,
      exlyRevenue,
      firstSeen: timeline.length ? timeline[timeline.length - 1].date : contact.createdAt,
      lastSeen: timeline.length ? timeline[0].date : contact.updatedAt,
    },
    crm: crmSection.crm,
    exly: exlySection.exly,
    outsourced: { rows: outsourced },
    newsletter: { rows: newsletter },
    bookedCalls: bookedSection.bookedCalls,
    enquiries: filteredEnquiries.map((t) => ({ ...t, parsed: parseEnquiryDescription(t.description) })),
    mail: { events: mailEvents, whatsappCampaigns: whatsappOutcomes },
    artistPath: artistPathSection.artistPath,
    timeline,
  };
}

module.exports = {
  findHubContact,
  getPersonBase,
  getPersonSection,
  getPerson360,
};
