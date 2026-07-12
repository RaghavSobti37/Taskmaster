const Task = require('../../tasks/models/Task');
const ContactService = require('../../../services/ContactService');
const { parseEnquiryDescription } = require('../queryHelpers');
const { filterEnquiriesForContact } = require('./enquiryMatch');

async function reconcileEnquiryTasks(enquiryTasks, { primaryName, email, phone, contact: initialContact }) {
  let contact = initialContact;
  for (const task of enquiryTasks) {
    const parsed = parseEnquiryDescription(task.description);
    contact = await ContactService.mergeContact({
      name: parsed.name || primaryName,
      email: parsed.email || email,
      phone: parsed.phone || phone,
      recordId: task._id,
      summary: { artist: parsed.artist, company: parsed.company, collaborationType: parsed.collaborationType },
      inletKey: 'enquiries',
    }, 'enquiries');
  }
  return contact;
}

async function loadEnquiriesSection(contact) {
  const enquiryTasks = await Task.find({ type: 'enquiry' }).sort({ createdAt: -1 }).limit(200).lean();
  const filtered = filterEnquiriesForContact(enquiryTasks, contact);
  return {
    section: 'enquiries',
    enquiries: filtered.map((t) => ({ ...t, parsed: parseEnquiryDescription(t.description) })),
  };
}

function appendEnquiriesTimeline(filteredEnquiries) {
  return filteredEnquiries.map((t) => ({
    type: 'enquiry',
    date: t.createdAt,
    label: `Enquiry: ${t.title}`,
    data: t,
  }));
}

async function buildEnquiriesAnalytics(result, { monthAgo }) {
  const tasks = await Task.find({ type: 'enquiry' }).select('description createdAt').lean();
  const byArtist = {};
  const byCollab = {};
  let thisMonth = 0;
  for (const t of tasks) {
    const parsed = parseEnquiryDescription(t.description);
    const artist = parsed.artist || 'Unknown';
    const collab = parsed.collaborationType || 'Unknown';
    byArtist[artist] = (byArtist[artist] || 0) + 1;
    byCollab[collab] = (byCollab[collab] || 0) + 1;
    if (t.createdAt && t.createdAt >= monthAgo) thisMonth += 1;
  }
  result.byArtist = Object.entries(byArtist).map(([artist, count]) => ({ artist, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  result.byCollab = Object.entries(byCollab).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  result.kpis = [
    { key: 'total', label: 'Total Enquiries', value: tasks.length },
    { key: 'month', label: 'This Month', value: thisMonth },
    { key: 'artists', label: 'Unique Artists', value: Object.keys(byArtist).length },
    { key: 'companies', label: 'With Company', value: tasks.filter((t) => parseEnquiryDescription(t.description).company).length },
  ];
}

module.exports = {
  reconcileEnquiryTasks,
  loadEnquiriesSection,
  appendEnquiriesTimeline,
  buildEnquiriesAnalytics,
  filterEnquiriesForContact,
};
