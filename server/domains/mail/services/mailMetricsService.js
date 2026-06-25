const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const MailEvent = require('../models/MailEvent');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');

const engagedRecipientPipeline = [
  { $unwind: '$recipients' },
  {
    $match: {
      'recipients.status': { $in: ['Opened', 'Clicked', 'Sent'] },
      'recipients.email': { $type: 'string', $ne: '' },
    },
  },
  {
    $group: {
      _id: { $toLower: { $trim: { input: '$recipients.email' } } },
    },
  },
];

async function getEngagedEmails() {
  const [coreRecipientEmails, mailRecipientEmails, eventEmails] = await Promise.all([
    aggregateWithTenant(Campaign, engagedRecipientPipeline),
    aggregateWithTenant(MailCampaign, engagedRecipientPipeline),
    aggregateWithTenant(MailEvent, [
      { $match: { eventType: { $in: ['Open', 'Click', 'Send'] }, email: { $type: 'string', $ne: '' } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$email' } } },
        },
      },
    ]),
  ]);

  const engagedEmailsSet = new Set();
  for (const row of [...coreRecipientEmails, ...mailRecipientEmails, ...eventEmails]) {
    if (row._id) engagedEmailsSet.add(row._id);
  }
  return Array.from(engagedEmailsSet);
}

async function getCumulativeTagMetrics() {
  const [coreAgg, mailAgg] = await Promise.all([
    aggregateWithTenant(Campaign, [
      {
        $group: {
          _id: { $ifNull: ['$eventTag', 'General'] },
          totalSent: { $sum: { $ifNull: ['$metrics.totalSent', 0] } },
          totalOpens: { $sum: { $ifNull: ['$metrics.opened', 0] } },
          totalClicks: { $sum: { $ifNull: ['$metrics.clicked', 0] } },
        },
      },
    ]),
    aggregateWithTenant(MailCampaign, [
      {
        $group: {
          _id: { $ifNull: ['$eventTag', 'General'] },
          totalSent: { $sum: { $ifNull: ['$stats.sent', 0] } },
          totalOpens: { $sum: { $ifNull: ['$stats.opened', 0] } },
          totalClicks: { $sum: { $ifNull: ['$stats.clicked', 0] } },
        },
      },
    ]),
  ]);
  return { coreAgg, mailAgg };
}

async function getUserCampaignRecipients(_userId) {
  const [coreCamps, mailCamps] = await Promise.all([
    Campaign.find({}, 'recipients').lean().setOptions(bypassOptions('org_campaign_recipients')),
    MailCampaign.find({}, 'recipients').lean().setOptions(bypassOptions('org_campaign_recipients')),
  ]);
  return { coreCamps, mailCamps };
}

const BOUNCE_STATUSES = ['Bounced', 'Failed', 'Invalid'];

async function countUserCampaignBounces(_userId) {
  const pipeline = [
    { $unwind: '$recipients' },
    { $match: { 'recipients.status': { $in: BOUNCE_STATUSES } } },
    { $count: 'total' },
  ];

  const [coreAgg, mailAgg] = await Promise.all([
    aggregateWithTenant(Campaign, pipeline),
    aggregateWithTenant(MailCampaign, pipeline),
  ]);

  return (coreAgg[0]?.total || 0) + (mailAgg[0]?.total || 0);
}

module.exports = {
  getEngagedEmails,
  getCumulativeTagMetrics,
  getUserCampaignRecipients,
  countUserCampaignBounces,
};
