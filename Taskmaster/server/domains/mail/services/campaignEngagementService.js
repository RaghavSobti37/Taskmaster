const MailEvent = require('../models/MailEvent');
const Campaign = require('../models/Campaign');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');
const { normalizeEmail, isValidEmail } = require('../../../utils/emailValidation');

const ENGAGEMENT_BYPASS = bypassOptions('campaign_audience_engagement');

const CAMPAIGN_ENGAGEMENT_ACTIVE = 'active';
const CAMPAIGN_ENGAGEMENT_INACTIVE = 'inactive';
const CAMPAIGN_ENGAGEMENT_NONE = 'none';

const ENGAGED_EVENT_TYPES = ['Open', 'Click'];
const ENGAGED_RECIPIENT_STATUSES = ['Opened', 'Clicked'];

const BATCH_SIZE = 5000;

function matchesCampaignEngagementFilter(engagement, filter) {
  if (!filter || filter === 'all') return true;
  const value = engagement || CAMPAIGN_ENGAGEMENT_NONE;
  if (filter === CAMPAIGN_ENGAGEMENT_NONE) return value === CAMPAIGN_ENGAGEMENT_NONE;
  return value === filter;
}

function uniqueNormalizedEmails(rawEmails) {
  const seen = new Set();
  const out = [];
  for (const raw of rawEmails || []) {
    const email = normalizeEmail(raw);
    if (!email || !isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

async function resolveCampaignEngagementByEmails(rawEmails) {
  const emails = uniqueNormalizedEmails(rawEmails);
  if (!emails.length) return {};

  const engagedSet = new Set();
  const historySet = new Set();

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const lowerBatch = batch.map((e) => e.toLowerCase());

    const [engagedEvents, anyEvents, recipientRows] = await Promise.all([
      MailEvent.distinct('email', {
        email: { $in: batch },
        eventType: { $in: ENGAGED_EVENT_TYPES },
      }).setOptions(ENGAGEMENT_BYPASS),
      MailEvent.distinct('email', { email: { $in: batch } }).setOptions(ENGAGEMENT_BYPASS),
      Campaign.aggregate([
        { $unwind: '$recipients' },
        {
          $match: {
            $expr: {
              $in: [{ $toLower: { $ifNull: ['$recipients.email', ''] } }, lowerBatch],
            },
          },
        },
        {
          $group: {
            _id: { $toLower: { $ifNull: ['$recipients.email', ''] } },
            hasEngaged: {
              $max: {
                $cond: [
                  { $in: ['$recipients.status', ENGAGED_RECIPIENT_STATUSES] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]).option(ENGAGEMENT_BYPASS),
    ]);

    for (const email of engagedEvents) {
      const key = normalizeEmail(email);
      if (key) {
        engagedSet.add(key);
        historySet.add(key);
      }
    }
    for (const email of anyEvents) {
      const key = normalizeEmail(email);
      if (key) historySet.add(key);
    }
    for (const row of recipientRows) {
      const key = normalizeEmail(row._id);
      if (!key) continue;
      historySet.add(key);
      if (row.hasEngaged) engagedSet.add(key);
    }
  }

  const result = {};
  for (const email of emails) {
    if (!historySet.has(email)) {
      result[email] = CAMPAIGN_ENGAGEMENT_NONE;
    } else if (engagedSet.has(email)) {
      result[email] = CAMPAIGN_ENGAGEMENT_ACTIVE;
    } else {
      result[email] = CAMPAIGN_ENGAGEMENT_INACTIVE;
    }
  }
  return result;
}

async function enrichContactsWithEngagement(contacts) {
  if (!Array.isArray(contacts) || !contacts.length) return contacts;
  const engagementMap = await resolveCampaignEngagementByEmails(contacts.map((c) => c.email));
  return contacts.map((contact) => ({
    ...contact,
    campaignEngagement: engagementMap[normalizeEmail(contact.email)] || CAMPAIGN_ENGAGEMENT_NONE,
  }));
}

async function filterContactsByEngagement(contacts, engagementFilter) {
  if (!Array.isArray(contacts) || !contacts.length) return contacts;
  if (!engagementFilter || engagementFilter === 'all') return contacts;

  const enriched = await enrichContactsWithEngagement(contacts);
  return enriched.filter((c) => matchesCampaignEngagementFilter(c.campaignEngagement, engagementFilter));
}

module.exports = {
  CAMPAIGN_ENGAGEMENT_ACTIVE,
  CAMPAIGN_ENGAGEMENT_INACTIVE,
  CAMPAIGN_ENGAGEMENT_NONE,
  matchesCampaignEngagementFilter,
  resolveCampaignEngagementByEmails,
  enrichContactsWithEngagement,
  filterContactsByEngagement,
};
