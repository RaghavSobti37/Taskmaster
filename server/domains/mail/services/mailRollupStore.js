const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const { isSupabaseEnabled } = require('../../../config/supabase');
const { queryPg, preferRestPostgres } = require('../../../services/supabase/client');
const { upsertRows, selectRows } = require('../../../services/supabase/restQuery');
const { buildCumulativeRegisteredLocationBreakdown } = require('../../../utils/campaignRegisteredLocation');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');
const logger = require('../../../utils/logger');

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

async function collectEngagedEmails() {
  const MailEvent = require('../models/MailEvent');
  const [coreRecipientEmails, mailRecipientEmails, eventEmails] = await Promise.all([
    Campaign.aggregate(engagedRecipientPipeline),
    MailCampaign.aggregate(engagedRecipientPipeline),
    MailEvent.aggregate([
      { $match: { eventType: { $in: ['Open', 'Click', 'Send'] }, email: { $type: 'string', $ne: '' } } },
      { $group: { _id: { $toLower: { $trim: { input: '$email' } } } } },
    ]),
  ]);

  const engagedEmailsSet = new Set();
  for (const row of [...coreRecipientEmails, ...mailRecipientEmails, ...eventEmails]) {
    if (row._id) engagedEmailsSet.add(row._id);
  }
  return Array.from(engagedEmailsSet);
}

async function computeCumulativeMetricsForUser(_userId) {
  const [coreAgg, mailAgg, engagedEmails] = await Promise.all([
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
    collectEngagedEmails(),
  ]);

  const aggregateData = mergeTagMetrics(coreAgg, mailAgg);
  const dynamicBreakdown = await buildCumulativeRegisteredLocationBreakdown(engagedEmails);
  return { aggregateData, dynamicBreakdown };
}

async function upsertMailRollupsForUser(userId, rollupDate, metrics) {
  if (preferRestPostgres()) {
    const tagRows = (metrics.aggregateData || []).map((row) => ({
      rollup_date: rollupDate,
      user_id: userId.toString(),
      event_tag: row.eventTag || 'General',
      total_sent: row.totalSent || 0,
      total_opens: row.totalOpens || 0,
      total_clicks: row.totalClicks || 0,
      open_rate: row.openRate || 0,
      ctr: row.ctr || 0,
      synced_at: new Date().toISOString(),
    }));
    if (tagRows.length) {
      await upsertRows('mail_event_tag_rollups', tagRows, {
        onConflict: 'rollup_date,user_id,event_tag',
      });
    }

    const geoRows = (metrics.dynamicBreakdown || []).map((row) => ({
      rollup_date: rollupDate,
      user_id: userId.toString(),
      location: row.location || 'unknown',
      city: row.city || null,
      country: row.country || null,
      opens: row.opens || 0,
      clicks: row.clicks || 0,
      total: row.total ?? ((row.opens || 0) + (row.clicks || 0)),
      synced_at: new Date().toISOString(),
    }));
    if (geoRows.length) {
      await upsertRows('mail_geo_rollups', geoRows, {
        onConflict: 'rollup_date,user_id,location',
      });
    }
    return;
  }

  for (const row of metrics.aggregateData) {
    await queryPg(
      `insert into mail_event_tag_rollups (
        rollup_date, user_id, event_tag, total_sent, total_opens, total_clicks, open_rate, ctr, synced_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
      on conflict (rollup_date, user_id, event_tag) do update set
        total_sent = excluded.total_sent,
        total_opens = excluded.total_opens,
        total_clicks = excluded.total_clicks,
        open_rate = excluded.open_rate,
        ctr = excluded.ctr,
        synced_at = now()`,
      [
        rollupDate,
        userId.toString(),
        row.eventTag || 'General',
        row.totalSent || 0,
        row.totalOpens || 0,
        row.totalClicks || 0,
        row.openRate || 0,
        row.ctr || 0,
      ]
    );
  }

  for (const row of metrics.dynamicBreakdown) {
    await queryPg(
      `insert into mail_geo_rollups (
        rollup_date, user_id, location, city, country, opens, clicks, total, synced_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
      on conflict (rollup_date, user_id, location) do update set
        city = excluded.city,
        country = excluded.country,
        opens = excluded.opens,
        clicks = excluded.clicks,
        total = excluded.total,
        synced_at = now()`,
      [
        rollupDate,
        userId.toString(),
        row.location || 'unknown',
        row.city || null,
        row.country || null,
        row.opens || 0,
        row.clicks || 0,
        row.total ?? ((row.opens || 0) + (row.clicks || 0)),
      ]
    );
  }
}

async function syncMailRollupsForAllUsers(rollupDate = new Date().toISOString().slice(0, 10)) {
  if (!isSupabaseEnabled()) {
    return { skipped: true, reason: 'disabled' };
  }

  const User = require('../../../models/User');
  const users = await User.find({}).select('_id').lean();
  const concurrency = Number(process.env.SUPABASE_ROLLUP_CONCURRENCY || 6);
  let synced = 0;

  for (let i = 0; i < users.length; i += concurrency) {
    const chunk = users.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (user) => {
      const metrics = await computeCumulativeMetricsForUser(user._id);
      await upsertMailRollupsForUser(user._id, rollupDate, metrics);
      synced += 1;
    }));
  }

  if (preferRestPostgres()) {
    await upsertRows('supabase_sync_state', [{
      stream: 'mail_rollups',
      last_synced_at: new Date().toISOString(),
      meta: { rollupDate, userCount: synced },
      updated_at: new Date().toISOString(),
    }], { onConflict: 'stream' });
  } else {
    await queryPg(
      `insert into supabase_sync_state (stream, last_synced_at, meta, updated_at)
       values ('mail_rollups', now(), $1::jsonb, now())
       on conflict (stream) do update set
         last_synced_at = now(),
         meta = excluded.meta,
         updated_at = now()`,
      [JSON.stringify({ rollupDate, userCount: synced })]
    );
  }

  logger.info('SupabaseMailRollup', `Synced rollups for ${synced} users`, { rollupDate });
  return { synced, rollupDate };
}

async function readLatestMailRollups(userId) {
  const userKey = userId.toString();

  if (preferRestPostgres()) {
    const allTagRows = await selectRows('mail_event_tag_rollups', {
      columns: 'rollup_date,event_tag,total_sent,total_opens,total_clicks,open_rate,ctr',
      filters: [['eq', ['user_id', userKey]]],
      order: { column: 'rollup_date', ascending: false },
    });
    const latestRollupDate = allTagRows[0]?.rollup_date;
    const tagRows = latestRollupDate
      ? allTagRows.filter((row) => row.rollup_date === latestRollupDate)
      : [];

    const allGeoRows = await selectRows('mail_geo_rollups', {
      columns: 'rollup_date,location,city,country,opens,clicks,total',
      filters: [['eq', ['user_id', userKey]]],
      order: { column: 'rollup_date', ascending: false },
    });
    const latestGeoDate = allGeoRows[0]?.rollup_date;
    const geoRows = latestGeoDate
      ? allGeoRows.filter((row) => row.rollup_date === latestGeoDate)
      : [];

    if (!tagRows.length && !geoRows.length) return null;

    return {
      aggregateData: tagRows.map((row) => ({
        eventTag: row.event_tag,
        totalSent: Number(row.total_sent || 0),
        totalOpens: Number(row.total_opens || 0),
        totalClicks: Number(row.total_clicks || 0),
        openRate: Number(row.open_rate || 0),
        ctr: Number(row.ctr || 0),
      })),
      dynamicBreakdown: geoRows.map((row) => ({
        location: row.location,
        city: row.city,
        country: row.country,
        opens: Number(row.opens || 0),
        clicks: Number(row.clicks || 0),
        total: Number(row.total || 0),
      })),
    };
  }

  const { rows: tagRows } = await queryPg(
    `select event_tag as "eventTag", total_sent as "totalSent", total_opens as "totalOpens",
            total_clicks as "totalClicks", open_rate as "openRate", ctr
     from mail_event_tag_rollups
     where user_id = $1
       and rollup_date = (select max(rollup_date) from mail_event_tag_rollups where user_id = $1)
     order by total_sent desc`,
    [userKey, userKey]
  );

  const { rows: geoRows } = await queryPg(
    `select location, city, country, opens, clicks, total
     from mail_geo_rollups
     where user_id = $1
       and rollup_date = (select max(rollup_date) from mail_geo_rollups where user_id = $1)
     order by total desc`,
    [userKey, userKey]
  );

  if (!tagRows.length && !geoRows.length) {
    return null;
  }

  return {
    aggregateData: tagRows.map((row) => ({
      eventTag: row.eventTag,
      totalSent: Number(row.totalSent || 0),
      totalOpens: Number(row.totalOpens || 0),
      totalClicks: Number(row.totalClicks || 0),
      openRate: Number(row.openRate || 0),
      ctr: Number(row.ctr || 0),
    })),
    dynamicBreakdown: geoRows.map((row) => ({
      location: row.location,
      city: row.city,
      country: row.country,
      opens: Number(row.opens || 0),
      clicks: Number(row.clicks || 0),
      total: Number(row.total || 0),
      count: Number(row.count || row.total || 0),
    })),
  };
}

module.exports = {
  computeCumulativeMetricsForUser,
  syncMailRollupsForAllUsers,
  readLatestMailRollups,
  mergeTagMetrics,
};
