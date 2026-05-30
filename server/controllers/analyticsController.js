const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const Lead = require('../models/Lead');
const MailEvent = require('../models/MailEvent');
const logger = require('../utils/logger');

const normalizeLocation = (raw) =>
  String(raw || 'unknown')
    .toLowerCase()
    .replace(/[().,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const mergeTagMetrics = (coreRows, mailRows) => {
  const tagMap = {};

  const addRow = (row) => {
    const tag = row._id || 'General';
    if (!tagMap[tag]) {
      tagMap[tag] = { eventTag: tag, totalSent: 0, totalOpens: 0, totalClicks: 0 };
    }
    tagMap[tag].totalSent += row.totalSent || 0;
    tagMap[tag].totalOpens += row.totalOpens || 0;
    tagMap[tag].totalClicks += row.totalClicks || 0;
  };

  coreRows.forEach(addRow);
  mailRows.forEach(addRow);

  return Object.values(tagMap)
    .map((item) => {
      const openRate = item.totalSent > 0
        ? Math.round((item.totalOpens / item.totalSent) * 100)
        : (item.totalOpens > 0 ? 100 : 0);
      const ctr = item.totalSent > 0
        ? Math.round((item.totalClicks / item.totalSent) * 100)
        : (item.totalClicks > 0 ? 100 : 0);
      return { ...item, openRate, ctr };
    })
    .sort((a, b) => b.totalSent - a.totalSent);
};

const collectEngagedEmails = async () => {
  const [recipientEmails, eventEmails] = await Promise.all([
    MailCampaign.aggregate([
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
    ]),
    MailEvent.aggregate([
      { $match: { eventType: { $in: ['Open', 'Click', 'Send'] }, email: { $type: 'string', $ne: '' } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$email' } } },
        },
      },
    ]),
  ]);

  const engagedEmailsSet = new Set();
  for (const row of [...recipientEmails, ...eventEmails]) {
    if (row._id) engagedEmailsSet.add(row._id);
  }
  return Array.from(engagedEmailsSet);
};

const buildLocationBreakdown = async (engagedEmails) => {
  const matchQuery = engagedEmails.length > 0
    ? { email: { $in: engagedEmails } }
    : { emailStatus: 'Active' };

  const rows = await Lead.aggregate([
    { $match: matchQuery },
    {
      $project: {
        loc: {
          $trim: {
            input: {
              $replaceAll: {
                input: {
                  $replaceAll: {
                    input: {
                      $replaceAll: {
                        input: { $toLower: { $ifNull: ['$location', { $ifNull: ['$city', 'unknown'] }] } },
                        find: '(',
                        replacement: '',
                      },
                    },
                    find: ')',
                    replacement: '',
                  },
                },
                find: ',',
                replacement: '',
              },
            },
          },
        },
      },
    },
    { $group: { _id: '$loc', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 100 },
  ]);

  return rows.map(({ _id, count }) => ({
    location: _id.charAt(0).toUpperCase() + _id.slice(1),
    count,
  }));
};

exports.getCumulativeMetrics = async (req, res) => {
  try {
    const userId = req.user._id;

    const [coreAgg, mailAgg, engagedEmails] = await Promise.all([
      Campaign.aggregate([
        { $match: { createdBy: userId } },
        {
          $group: {
            _id: { $ifNull: ['$eventTag', 'General'] },
            totalSent: { $sum: { $ifNull: ['$metrics.totalSent', 0] } },
            totalOpens: { $sum: { $ifNull: ['$metrics.opened', 0] } },
            totalClicks: { $sum: { $ifNull: ['$metrics.clicked', 0] } },
          },
        },
      ]),
      MailCampaign.aggregate([
        { $match: { createdBy: userId } },
        {
          $group: {
            _id: { $ifNull: ['$eventTag', 'General'] },
            totalSent: { $sum: { $ifNull: ['$stats.sent', 0] } },
            totalOpens: { $sum: { $ifNull: ['$stats.opened', 0] } },
            totalClicks: { $sum: { $ifNull: ['$stats.clicked', 0] } },
          },
        },
      ]),
      collectEngagedEmails(),
    ]);

    const aggregateData = mergeTagMetrics(coreAgg, mailAgg);
    const dynamicBreakdown = await buildLocationBreakdown(engagedEmails);

    res.status(200).json({ aggregateData, dynamicBreakdown });
  } catch (error) {
    logger.error('analyticsController', 'Cumulative metrics ', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
};

exports.getLocationLeads = async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: 'Location query parameter required' });

    const targetLoc = normalizeLocation(location);
    const engagedEmails = await collectEngagedEmails();
    const matchQuery = engagedEmails.length > 0
      ? { email: { $in: engagedEmails } }
      : { emailStatus: 'Active' };

    const matchedLeads = await Lead.aggregate([
      { $match: matchQuery },
      {
        $addFields: {
          normalizedLoc: {
            $trim: {
              input: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: {
                        $replaceAll: {
                          input: { $toLower: { $ifNull: ['$location', { $ifNull: ['$city', 'unknown'] }] } },
                          find: '(',
                          replacement: '',
                        },
                      },
                      find: ')',
                      replacement: '',
                    },
                  },
                  find: ',',
                  replacement: '',
                },
              },
            },
          },
        },
      },
      { $match: { normalizedLoc: targetLoc } },
      { $limit: 500 },
    ]);

    res.status(200).json(matchedLeads);
  } catch (error) {
    logger.error('analyticsController', 'Get location leads ', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
};
