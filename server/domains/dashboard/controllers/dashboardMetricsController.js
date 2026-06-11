const Lead = require('../../../models/Lead');
const logger = require('../../../utils/logger');
const { buildCumulativeRegisteredLocationBreakdown } = require('../../../utils/campaignRegisteredLocation');
const { getEngagedEmails, getCumulativeTagMetrics } = require('../../mail/services/mailMetricsService');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');

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

exports.getCumulativeMetrics = async (req, res) => {
  try {
    const userId = req.user._id;

    try {
      const { isSupabaseEnabled } = require('../../../config/supabase');
      const { readLatestMailRollups } = require('../../../services/supabase/mailRollupStore');
      if (isSupabaseEnabled()) {
        const cached = await readLatestMailRollups(userId);
        if (cached?.aggregateData?.length || cached?.dynamicBreakdown?.length) {
          return res.status(200).json({
            ...cached,
            source: 'supabase',
          });
        }
      }
    } catch (supabaseReadErr) {
      logger.warn('dashboardMetricsController', 'Supabase rollup read failed — falling back to Mongo', {
        error: supabaseReadErr.message,
      });
    }

    const [{ coreAgg, mailAgg }, engagedEmails] = await Promise.all([
      getCumulativeTagMetrics(userId),
      getEngagedEmails(),
    ]);

    const aggregateData = mergeTagMetrics(coreAgg, mailAgg);
    const dynamicBreakdown = await buildCumulativeRegisteredLocationBreakdown(engagedEmails);

    res.status(200).json({ aggregateData, dynamicBreakdown, source: 'mongo' });
  } catch (error) {
    logger.error('dashboardMetricsController', 'Cumulative metrics ', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
};

exports.getLocationLeads = async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: 'Location query parameter required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const targetLoc = normalizeLocation(location);
    const engagedEmails = await getEngagedEmails();
    const matchQuery = engagedEmails.length > 0
      ? { email: { $in: engagedEmails } }
      : { emailStatus: 'Active' };

    const pipeline = [
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
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await aggregateWithTenant(Lead, pipeline);
    const matchedLeads = result?.data || [];
    const total = result?.total?.[0]?.count || 0;

    res.status(200).json({
      data: matchedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    logger.error('dashboardMetricsController', 'Get location leads ', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
};
