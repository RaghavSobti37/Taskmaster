const mongoose = require('mongoose');
const { formatDisplayDate } = require('../../shared/dateDisplay');
const CRMAudit = require('../models/CRMAudit');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { resolvePrimaryCallAssigneeId } = require('../utils/primaryCallAssignee');
const { listSalesDepartmentReps } = require('../utils/bookedCallRepAssignment');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { warmPipelineQuery } = require('../utils/crmPipelineFilters');
const { getDateKey, todayEnd, startOfDayFromKey, endOfDayFromKey } = require('../utils/attendanceDate');
const { loadCrmDigestConfig } = require('./crmDigestSettingsService');

const BYPASS = bypassOptions('crm-daily-stats');

const ARTIST_SECTION = {
  key: 'artist',
  title: 'Artist Calls',
  subtitle: 'Artist bookings & artist CRM',
  crmType: 'artist',
  resolveUserId: resolvePrimaryCallAssigneeId,
};

async function buildRepSectionMetas() {
  const metas = [ARTIST_SECTION];
  const salesReps = await listSalesDepartmentReps();
  for (const rep of salesReps) {
    const repId = rep._id;
    metas.push({
      key: `sales-${repId}`,
      title: 'Sales & Other Calls',
      subtitle: `${rep.name} — website book-a-call & sales CRM`,
      crmType: 'sales',
      resolveUserId: async () => repId,
    });
  }
  return metas;
}

const STAT_ROWS = [
  { key: 'callsMade', label: 'Calls made', highlight: true },
  { key: 'connected', label: 'Connected', highlight: true },
  { key: 'meaningful', label: 'Meaningful', highlight: true },
  { key: 'converted', label: 'Converted', highlight: true },
  { key: 'busy', label: 'Busy' },
  { key: 'dnp', label: 'DNP / no answer' },
  { key: 'followupsSet', label: 'Follow-ups set' },
  { key: 'notesAdded', label: 'Notes added' },
  { key: 'leadsTouched', label: 'Leads updated' },
];

const PIPELINE_ROWS = [
  { key: 'totalLeads', label: 'Assigned leads' },
  { key: 'connected', label: 'Connected (pipeline)' },
  { key: 'meaningful', label: 'Meaningful (pipeline)' },
  { key: 'warmLeads', label: 'Warm pipeline' },
  { key: 'converted', label: 'Converted (pipeline)' },
  { key: 'conversionRate', label: 'Conversion rate', suffix: '%' },
];

const DEFAULT_PLAN_VALUES = {
  'One-Time': 0,
  '3 Mo': 0,
  '6 Mo': 0,
  '9 Mo': 0,
};

const getMonthStartFromKey = (dateKey) => {
  const key = String(dateKey || getDateKey());
  const monthPrefix = key.slice(0, 7);
  return startOfDayFromKey(`${monthPrefix}-01`);
};

const getMonthToDateRange = (dateKey = getDateKey()) => ({
  rangeStart: getMonthStartFromKey(dateKey),
  rangeEnd: dateKey === getDateKey() ? todayEnd() : endOfDayFromKey(dateKey),
});

const formatMonthLabel = (dateKey) => {
  const anchor = new Date(`${dateKey}T12:00:00+05:30`);
  return anchor.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
};

const formatLakhs = (rupees) => {
  const lakhs = (Number(rupees) || 0) / 100000;
  if (lakhs === 0) return '0 Lakhs';
  const formatted = Number(lakhs.toFixed(2)).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
  return `${formatted} Lakhs`;
};

const resolveLeadDealValue = (lead, planValueMap = DEFAULT_PLAN_VALUES) => {
  const metadata = lead?.metadata || {};
  const fromMetadata = Number(metadata.dealValue ?? metadata.dealAmount ?? metadata.convertedValue);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata;
  const planValue = planValueMap[lead?.planOption];
  return Number.isFinite(Number(planValue)) && Number(planValue) > 0 ? Number(planValue) : 0;
};

const summarizeMonthlyBusinessFromLeads = (leads, targetLakhs = 0, planValueMap = DEFAULT_PLAN_VALUES) => {
  const leadsClosed = leads.length;
  const totalValueRupees = leads.reduce((sum, lead) => sum + resolveLeadDealValue(lead, planValueMap), 0);
  const valueLakhs = totalValueRupees / 100000;
  const progressPct = targetLakhs > 0
    ? Number(((valueLakhs / targetLakhs) * 100).toFixed(1))
    : null;

  return {
    leadsClosed,
    totalValueRupees,
    valueLakhs,
    targetLakhs,
    progressPct,
    valueLabel: formatLakhs(totalValueRupees),
    targetLabel: targetLakhs > 0 ? formatLakhs(targetLakhs * 100000) : null,
  };
};

async function fetchMonthlyBusinessDone(dateKey = getDateKey(), crmType = 'sales', digestSettings = null) {
  const { rangeStart, rangeEnd } = getMonthToDateRange(dateKey);
  const targetLakhs = digestSettings?.monthlyTargetLakhs || 0;
  const planValueMap = digestSettings?.planValues || { ...DEFAULT_PLAN_VALUES };
  const conversionAudits = await CRMAudit.find({
    fieldChanged: 'leadStatus',
    newValue: { $regex: /^converted$/i },
    timestamp: { $gte: rangeStart, $lte: rangeEnd },
  })
    .select('leadId')
    .lean()
    .setOptions(BYPASS);

  const leadIds = [...new Set(conversionAudits.map((log) => String(log.leadId)).filter(Boolean))];
  if (!leadIds.length) {
    return summarizeMonthlyBusinessFromLeads([], targetLakhs, planValueMap);
  }

  const leads = await Lead.find({
    _id: { $in: leadIds },
    crmType,
  })
    .select('planOption metadata')
    .lean()
    .setOptions(BYPASS);

  return summarizeMonthlyBusinessFromLeads(leads, targetLakhs, planValueMap);
}

async function fetchMonthlyBusinessOverview(dateKey = getDateKey()) {
  const digestConfig = await loadCrmDigestConfig();
  const [academy, films] = await Promise.all([
    fetchMonthlyBusinessDone(dateKey, 'sales', digestConfig.academy?.settings),
    fetchMonthlyBusinessDone(dateKey, 'artist', digestConfig.films?.settings),
  ]);
  return {
    monthLabel: formatMonthLabel(dateKey),
    academy: {
      ...academy,
      title: digestConfig.academy?.segment?.digestTitle || 'Academy business (month)',
      projectName: digestConfig.academy?.projectName || 'TSC Academy',
    },
    films: {
      ...films,
      title: digestConfig.films?.segment?.digestTitle || 'Artist business (month)',
      projectName: digestConfig.films?.projectName || 'TSC Films',
    },
  };
}

const formatDateLabel = (dateKey) => {
  const anchor = new Date(`${dateKey}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(anchor);
};

const formatShortDate = (date) => formatDisplayDate(date);

const getLookbackRange = (lookbackDays = 1, endDateKey = getDateKey()) => {
  const days = Math.max(1, parseInt(String(lookbackDays), 10) || 1);
  const rangeEnd = endDateKey === getDateKey() ? todayEnd() : endOfDayFromKey(endDateKey);
  const rangeStart = startOfDayFromKey(endDateKey);
  if (days > 1) {
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
  }
  return { rangeStart, rangeEnd, lookbackDays: days, endDateKey };
};

const formatPeriodLabel = (lookbackDays, endDateKey) => {
  if (lookbackDays <= 1) return formatDateLabel(endDateKey);
  const endAnchor = new Date(`${endDateKey}T12:00:00+05:30`);
  const startAnchor = new Date(endAnchor);
  startAnchor.setDate(startAnchor.getDate() - (lookbackDays - 1));
  return `${formatShortDate(startAnchor)} – ${formatShortDate(endAnchor)} (last ${lookbackDays} days)`;
};

const normalizeValue = (value) => String(value ?? '').trim();

const matchesValue = (value, pattern) => pattern.test(normalizeValue(value));

function emptyDailyStats() {
  return {
    callsMade: 0,
    connected: 0,
    meaningful: 0,
    converted: 0,
    busy: 0,
    dnp: 0,
    followupsSet: 0,
    notesAdded: 0,
    leadsTouched: 0,
  };
}

function summarizeDailyCallStats(auditLogs) {
  const stats = emptyDailyStats();
  const callLeadIds = new Set();
  const touchedLeadIds = new Set();

  for (const log of auditLogs) {
    const leadKey = log.leadId ? String(log.leadId) : null;
    if (leadKey) touchedLeadIds.add(leadKey);

    const field = log.fieldChanged;
    const newVal = normalizeValue(log.newValue);
    const oldVal = normalizeValue(log.oldValue);
    if (!newVal || newVal === oldVal) continue;

    if (field === 'callStatus') {
      if (leadKey) callLeadIds.add(leadKey);
      if (matchesValue(newVal, /^connected$/i)) stats.connected += 1;
      else if (matchesValue(newVal, /^busy$/i)) stats.busy += 1;
      else if (matchesValue(newVal, /^dnp$/i)) stats.dnp += 1;
    } else if (field === 'meaningfulConnect' && matchesValue(newVal, /^yes$/i)) {
      stats.meaningful += 1;
    } else if (field === 'leadStatus' && matchesValue(newVal, /^converted$/i)) {
      stats.converted += 1;
    } else if (field === 'nextFollowupDate' || field === 'nextFollowupTime') {
      stats.followupsSet += 1;
    } else if (field === 'notes') {
      stats.notesAdded += 1;
    }
  }

  stats.callsMade = callLeadIds.size;
  stats.leadsTouched = touchedLeadIds.size;
  return stats;
}

async function fetchAuditLogsForRep(userId, rangeStart, rangeEnd) {
  const userIdStr = String(userId);
  return CRMAudit.find({
    userId: { $in: [userId, userIdStr] },
    timestamp: { $gte: rangeStart, $lte: rangeEnd },
  })
    .select('leadId fieldChanged oldValue newValue timestamp')
    .lean()
    .setOptions(BYPASS);
}

async function fetchPipelineTotalsForRep(repId, crmType) {
  const match = {
    assignedRepId: new mongoose.Types.ObjectId(String(repId)),
  };
  if (crmType) match.crmType = crmType;
  return fetchPipelineTotalsForMatch(match);
}

async function fetchPipelineTotalsForMatch(match = {}) {
  const [result] = await Lead.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'count' }],
        connected: [{ $match: { callStatus: 'Connected' } }, { $count: 'count' }],
        meaningful: [{ $match: { meaningfulConnect: 'YES' } }, { $count: 'count' }],
        warmLeads: [{ $match: warmPipelineQuery() }, { $count: 'count' }],
        converted: [{ $match: { leadStatus: 'Converted' } }, { $count: 'count' }],
      },
    },
  ]).option(BYPASS);

  const totalLeads = result?.total?.[0]?.count || 0;
  const converted = result?.converted?.[0]?.count || 0;
  const conversionRate = totalLeads > 0 ? Number(((converted / totalLeads) * 100).toFixed(1)) : 0;

  return {
    totalLeads,
    connected: result?.connected?.[0]?.count || 0,
    meaningful: result?.meaningful?.[0]?.count || 0,
    warmLeads: result?.warmLeads?.[0]?.count || 0,
    converted,
    conversionRate,
  };
}

async function fetchPlatformOverview() {
  const [all, sales, artist] = await Promise.all([
    fetchPipelineTotalsForMatch({}),
    fetchPipelineTotalsForMatch({ crmType: 'sales' }),
    fetchPipelineTotalsForMatch({ crmType: 'artist' }),
  ]);
  return {
    all: { label: 'All CRM', ...all },
    sales: { label: 'Sales CRM', ...sales },
    artist: { label: 'Artist CRM', ...artist },
  };
}

async function resolveRepSections(rangeStart, rangeEnd) {
  const sections = [];
  const sectionMetas = await buildRepSectionMetas();

  for (const sectionMeta of sectionMetas) {
    const userId = await sectionMeta.resolveUserId();
    if (!userId) {
      sections.push({
        sectionMeta,
        repUser: null,
        dailyStats: emptyDailyStats(),
        pipelineStats: {
          totalLeads: 0,
          connected: 0,
          meaningful: 0,
          warmLeads: 0,
          converted: 0,
          conversionRate: 0,
        },
        error: `${sectionMeta.key} rep not found`,
      });
      continue;
    }

    const [repUser, auditLogs, pipelineStats] = await Promise.all([
      User.findById(userId).select('name email').lean().setOptions(BYPASS),
      fetchAuditLogsForRep(userId, rangeStart, rangeEnd),
      fetchPipelineTotalsForRep(userId, sectionMeta.crmType),
    ]);

    sections.push({
      sectionMeta,
      repUser,
      dailyStats: summarizeDailyCallStats(auditLogs),
      pipelineStats,
    });
  }

  return sections;
}

function buildDailyActivityTrend(auditLogs, days, endDateKey) {
  const { rangeEnd } = getLookbackRange(days, endDateKey);
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(rangeEnd);
    d.setDate(d.getDate() - i);
    keys.push(getDateKey(d));
  }
  const byDay = Object.fromEntries(keys.map((k) => [k, []]));
  for (const log of auditLogs) {
    const k = getDateKey(new Date(log.timestamp));
    if (byDay[k]) byDay[k].push(log);
  }
  return keys.map((k) => {
    const d = new Date(`${k}T12:00:00+05:30`);
    const stats = summarizeDailyCallStats(byDay[k]);
    return {
      date: formatShortDate(d),
      calls: stats.callsMade,
      connected: stats.connected,
      meaningful: stats.meaningful,
      converted: stats.converted,
    };
  });
}

function buildPipelineDistributionChart(platformOverview) {
  const all = platformOverview?.all || {};
  return [
    { label: 'Assigned', value: all.totalLeads || 0 },
    { label: 'Connected', value: all.connected || 0 },
    { label: 'Meaningful', value: all.meaningful || 0 },
    { label: 'Warm', value: all.warmLeads || 0 },
    { label: 'Converted', value: all.converted || 0 },
  ];
}

async function getCrmStatsTrends(options = {}) {
  const dateKey = options.dateKey || getDateKey();
  const days = Math.min(30, Math.max(7, parseInt(String(options.days ?? 30), 10) || 30));
  const { rangeStart, rangeEnd } = getLookbackRange(days, dateKey);

  const [auditLogs, platformOverview] = await Promise.all([
    CRMAudit.find({
      timestamp: { $gte: rangeStart, $lte: rangeEnd },
    })
      .select('leadId fieldChanged oldValue newValue timestamp userId')
      .lean()
      .setOptions(BYPASS),
    fetchPlatformOverview(),
  ]);

  return {
    days,
    dateKey,
    activityChartData: buildDailyActivityTrend(auditLogs, days, dateKey),
    pipelineChartData: buildPipelineDistributionChart(platformOverview),
    platformOverview,
  };
}

async function getCrmStatsReport(options = {}) {
  const dateKey = options.dateKey || getDateKey();
  const lookbackDays = Math.min(30, Math.max(1, parseInt(String(options.lookbackDays ?? 1), 10) || 1));
  const { rangeStart, rangeEnd } = getLookbackRange(lookbackDays, dateKey);
  const periodLabel = formatPeriodLabel(lookbackDays, dateKey);

  const [sections, monthlyBusiness, platformOverview] = await Promise.all([
    resolveRepSections(rangeStart, rangeEnd),
    fetchMonthlyBusinessOverview(dateKey),
    fetchPlatformOverview(),
  ]);

  return {
    dateKey,
    lookbackDays,
    periodLabel,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    platformOverview,
    monthlyBusiness,
    statRows: STAT_ROWS,
    pipelineRows: PIPELINE_ROWS,
    sections: sections.map(({ sectionMeta, repUser, dailyStats, pipelineStats, error }) => ({
      key: sectionMeta.key,
      title: sectionMeta.title,
      subtitle: sectionMeta.subtitle,
      crmType: sectionMeta.crmType,
      rep: repUser ? { name: repUser.name, email: repUser.email } : null,
      dailyStats,
      pipelineStats,
      error: error || null,
    })),
  };
}

module.exports = {
  getCrmStatsReport,
  getCrmStatsTrends,
  getCrmDailyStatsReport: getCrmStatsReport,
  summarizeDailyCallStats,
  buildDailyActivityTrend,
  buildPipelineDistributionChart,
  fetchAuditLogsForRep,
  fetchPipelineTotalsForRep,
  fetchPipelineTotalsForMatch,
  fetchPlatformOverview,
  fetchMonthlyBusinessDone,
  fetchMonthlyBusinessOverview,
  summarizeMonthlyBusinessFromLeads,
  resolveLeadDealValue,
  formatLakhs,
  buildRepSectionMetas,
  STAT_ROWS,
  PIPELINE_ROWS,
};
