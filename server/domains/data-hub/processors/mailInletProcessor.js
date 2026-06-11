const {
  countByEmail,
  findByEmail,
  aggregateEventTypeCounts,
  distinctEmails,
} = require('../../mail/services/mailEventQueryService');
const ContactService = require('../../../services/ContactService');

async function reconcileMailEngagement(email, { primaryName, phone, contact: initialContact }) {
  if (!email) return initialContact;
  const mailCount = await countByEmail(email);
  if (mailCount === 0) return initialContact;
  return ContactService.mergeContact({
    name: primaryName,
    email,
    phone,
    inletKey: 'mail',
    summary: { mailEventCount: mailCount },
  }, 'mailer');
}

async function loadMailSection(contact) {
  const events = contact.email
    ? await findByEmail(contact.email)
    : [];
  return { section: 'mail', mail: { events } };
}

function appendMailTimeline(mailEvents) {
  return mailEvents.map((evt) => ({
    type: 'mail',
    date: evt.timestamp || evt.createdAt,
    label: `Mail ${evt.eventType}`,
    data: evt,
  }));
}

async function buildMailAnalytics(result, { total }) {
  const mailStats = await aggregateEventTypeCounts();
  const sends = mailStats.find((s) => s._id === 'Send')?.count || 0;
  const opens = mailStats.find((s) => s._id === 'Open')?.count || 0;
  const clicks = mailStats.find((s) => s._id === 'Click')?.count || 0;
  const bounces = mailStats.find((s) => s._id === 'Bounce')?.count || 0;
  const uniqueEmails = await distinctEmails();
  result.mailStats = mailStats;
  result.kpis = [
    { key: 'engaged', label: 'Engaged People', value: total },
    { key: 'uniqueEmails', label: 'Unique Emails', value: uniqueEmails.filter(Boolean).length },
    { key: 'openRate', label: 'Open Rate', value: sends ? Math.round((opens / sends) * 100) : 0, format: 'percent' },
    { key: 'clickRate', label: 'Click Rate', value: sends ? Math.round((clicks / sends) * 100) : 0, format: 'percent' },
  ];
  result.rates = { sends, opens, clicks, bounces };
}

module.exports = {
  reconcileMailEngagement,
  loadMailSection,
  appendMailTimeline,
  buildMailAnalytics,
};
