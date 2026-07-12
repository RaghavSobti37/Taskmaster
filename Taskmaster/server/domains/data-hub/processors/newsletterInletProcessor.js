const NewsletterSubscriber = require('../../../models/NewsletterSubscriber');
const ContactService = require('../../../services/ContactService');

async function reconcileNewsletterRows(newsletter, { primaryName, email, phone, contact: initialContact }) {
  let contact = initialContact;
  for (const row of newsletter) {
    contact = await ContactService.mergeContact({
      name: row.name || primaryName,
      email: row.email || email,
      phone: row.phone || phone,
      city: row.city,
      emailStatus: row.emailStatus,
      unsubscribed: row.unsubscribed,
      recordId: row._id,
      summary: { source: row.source, subscribedAt: row.subscribedAt },
      inletKey: 'newsletter',
    }, 'newsletter');
  }
  return contact;
}

async function loadNewsletterSection(match) {
  const rows = await NewsletterSubscriber.find(match).sort({ subscribedAt: -1 }).lean();
  return { section: 'newsletter', newsletter: { rows } };
}

function appendNewsletterTimeline(newsletter) {
  return newsletter.map((row) => ({
    type: 'newsletter',
    date: row.subscribedAt || row.createdAt,
    label: `Newsletter: ${row.source || 'signup'}`,
    data: row,
  }));
}

module.exports = {
  reconcileNewsletterRows,
  loadNewsletterSection,
  appendNewsletterTimeline,
};
