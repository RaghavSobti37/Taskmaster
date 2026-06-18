const cron = require('node-cron');
const mongoose = require('mongoose');
const CRMAudit = require('../models/CRMAudit');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { dispatchEmailPayload } = require('./mailDriver');
const { resolvePrimaryCallAssigneeId } = require('../utils/primaryCallAssignee');
const { resolveSatyamSalesRepId } = require('../utils/bookedCallRepAssignment');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { warmPipelineQuery } = require('../utils/crmPipelineFilters');
const { getDateKey, todayEnd, startOfDayFromKey, endOfDayFromKey } = require('../utils/attendanceDate');
const { getSharedRedis } = require('../utils/sharedRedis');
const logger = require('../utils/logger');
const { MODULE } = require('../../shared/systemLogContract');

const BYPASS = bypassOptions('crm-reach-out-digest');
const redis = getSharedRedis();

const REP_SECTIONS = [
  {
    key: 'akash',
    title: 'Artist Calls',
    subtitle: 'Akash — artist bookings & artist CRM',
    crmType: 'artist',
    resolveUserId: resolvePrimaryCallAssigneeId,
  },
  {
    key: 'satyam',
    title: 'Sales & Other Calls',
    subtitle: 'Satyam — website book-a-call & sales CRM',
    crmType: 'sales',
    resolveUserId: resolveSatyamSalesRepId,
  },
];

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

const parseRecipientEmails = (raw) => {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return [...new Set(
    parts
      .flatMap((entry) => String(entry).split(/[,;]/))
      .map((email) => email.trim())
      .filter(Boolean),
  )];
};

const getRecipientEmails = () =>
  parseRecipientEmails(process.env.CRM_REACH_OUT_DIGEST_EMAIL || process.env.ADMIN_EMAIL || '');

const getRecipientEmail = () => getRecipientEmails().join(', ');

const getFromEmail = () => {
  const raw = (
    process.env.CRM_REACH_OUT_DIGEST_FROM
    || process.env.SYSTEM_VERIFIED_FROM_EMAIL
    || 'noreply@theshakticollective.in'
  ).trim();
  if (raw.includes('<') && raw.includes('>')) return raw;
  return `"CoreKnot CRM" <${raw}>`;
};

const isEnabled = () => {
  const flag = (process.env.CRM_REACH_OUT_DIGEST_ENABLED || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDateLabel = (dateKey) => {
  const anchor = new Date(`${dateKey}T12:00:00+05:30`);
  return anchor.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
};

const formatShortDate = (date) =>
  date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

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

/** Count today's call activity from CRM audit logs (no field-level detail in email). */
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

function renderStatGrid(rows, stats, { periodLabel }) {
  const cells = rows.map(({ key, label, highlight, suffix = '' }) => {
    const raw = stats[key] ?? 0;
    const display = suffix && typeof raw === 'number' ? `${raw}${suffix}` : raw;
    const color = highlight ? '#2dd4bf' : '#f8fafc';
    return `
      <div style="padding:14px;border:1px solid #334155;border-radius:8px;background:#111827;text-align:center;">
        <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(label)}</p>
        <p style="margin:0;color:${color};font-size:26px;font-weight:700;line-height:1;">${escapeHtml(display)}</p>
      </div>
    `;
  }).join('');

  return `
    <div style="margin:0 0 16px;">
      <p style="margin:0 0 10px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">${escapeHtml(periodLabel)}</p>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
        ${cells}
      </div>
    </div>
  `;
}

function buildRepSectionHtml(sectionMeta, repUser, dailyStats, pipelineStats, periodLabel) {
  const repName = repUser?.name || sectionMeta.title;
  const activityLabel = periodLabel.includes('days') ? 'Activity (period)' : "Today's activity";
  const hasActivity = STAT_ROWS.some(({ key }) => (dailyStats[key] || 0) > 0);

  return `
    <section style="margin:0 0 28px;padding:20px;border:1px solid #334155;border-radius:10px;background:#0f172a;">
      <h2 style="margin:0 0 4px;color:#2dd4bf;font-size:18px;">${escapeHtml(sectionMeta.title)}</h2>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">${escapeHtml(sectionMeta.subtitle)} · ${escapeHtml(repName)}</p>
      ${renderStatGrid(STAT_ROWS, dailyStats, { periodLabel: activityLabel })}
      ${!hasActivity ? '<p style="margin:0 0 16px;color:#64748b;font-size:13px;">No call activity recorded for this period.</p>' : ''}
      ${renderStatGrid(PIPELINE_ROWS, pipelineStats, { periodLabel: 'Assigned pipeline (current)' })}
    </section>
  `;
}

function buildDigestHtml({ periodLabel, sections, testMode = false }) {
  const body = sections.map(({ sectionMeta, repUser, dailyStats, pipelineStats }) =>
    buildRepSectionHtml(sectionMeta, repUser, dailyStats, pipelineStats, periodLabel)
  ).join('');

  const title = testMode ? 'CRM Call Stats (Test)' : 'CRM Daily Call Stats';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#cbd5e1;max-width:640px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:28px;">
      <h1 style="color:#f8fafc;margin:0 0 8px;font-size:22px;font-weight:600;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.5;">
        ${escapeHtml(periodLabel)} · Akash (artist) and Satyam (sales) call stats from CoreKnot CRM.
      </p>
      ${body}
      <p style="color:#64748b;font-size:12px;margin:24px 0 0;">Activity counts are based on CRM updates during the period. Pipeline totals reflect current assigned leads.</p>
    </div>
  `;
}

async function resolveRepSections(rangeStart, rangeEnd) {
  const sections = [];

  for (const sectionMeta of REP_SECTIONS) {
    const userId = await sectionMeta.resolveUserId();
    if (!userId) {
      sections.push({
        sectionMeta,
        repUser: null,
        dailyStats: emptyDailyStats(),
        pipelineStats: { totalLeads: 0, connected: 0, meaningful: 0, warmLeads: 0, converted: 0, conversionRate: 0 },
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

const acquireLock = async (lockKey, ttlSeconds = 300) => {
  try {
    if (!redis || typeof redis.set !== 'function' || redis.status !== 'ready') return true;
    const result = await redis.set(lockKey, 'locked', 'PX', ttlSeconds * 1000, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn('CrmReachOutDigest', `Lock acquire failed: ${lockKey}`, { error: err.message });
    return false;
  }
};

const releaseLock = async (lockKey) => {
  try {
    if (!redis || typeof redis.del !== 'function' || redis.status !== 'ready') return;
    await redis.del(lockKey);
  } catch (err) {
    logger.warn('CrmReachOutDigest', `Lock release failed: ${lockKey}`, { error: err.message });
  }
};

async function runCrmReachOutDigest(options = {}) {
  const {
    dateKey = getDateKey(),
    dryRun = false,
    forceSend = false,
    lookbackDays = 1,
    recipient: recipientOverride = null,
    testMode = false,
    skipLock = false,
  } = options;

  if (!isEnabled() && !forceSend && !testMode) {
    return { sent: false, reason: 'disabled' };
  }

  const recipients = recipientOverride
    ? parseRecipientEmails(recipientOverride)
    : getRecipientEmails();
  if (!recipients.length) {
    logger.warn('CrmReachOutDigest', 'No CRM_REACH_OUT_DIGEST_EMAIL configured');
    return { sent: false, reason: 'missing_recipient' };
  }
  const recipient = recipients.join(', ');

  const { rangeStart, rangeEnd } = options.rangeStart && options.rangeEnd
    ? { rangeStart: options.rangeStart, rangeEnd: options.rangeEnd }
    : getLookbackRange(lookbackDays, dateKey);
  const periodLabel = formatPeriodLabel(lookbackDays, dateKey);
  const lockKey = `crm-reach-out-digest:${dateKey}:${lookbackDays}`;

  if (!dryRun && !skipLock && !testMode) {
    const hasLock = await acquireLock(lockKey, 600);
    if (!hasLock) {
      logger.debug('CrmReachOutDigest', 'Skipping digest — lock exists', { dateKey });
      return { sent: false, reason: 'lock_exists', dateKey };
    }
  }

  try {
    const sections = await resolveRepSections(rangeStart, rangeEnd);
    const html = buildDigestHtml({ periodLabel, sections, testMode });
    const subjectPrefix = testMode ? '[CoreKnot] [TEST] ' : '[CoreKnot] ';
    const subject = `${subjectPrefix}CRM call stats — ${periodLabel}`;

    const sectionSummary = sections.map(({ sectionMeta, repUser, dailyStats, error }) => ({
      key: sectionMeta.key,
      rep: repUser?.name || null,
      callsMade: dailyStats.callsMade,
      connected: dailyStats.connected,
      meaningful: dailyStats.meaningful,
      converted: dailyStats.converted,
      error: error || null,
    }));

    if (dryRun) {
      return {
        sent: false,
        dryRun: true,
        dateKey,
        lookbackDays,
        periodLabel,
        recipient,
        subject,
        sections: sectionSummary,
      };
    }

    await dispatchEmailPayload({
      to: recipients,
      subject,
      html,
      from: getFromEmail(),
    });

    logger.info('CrmReachOutDigest', 'Daily stats digest sent', {
      dateKey,
      recipients,
      sections: sectionSummary,
      module: MODULE.SYSTEM,
    });

    return {
      sent: true,
      dateKey,
      recipient,
      recipients,
      sections: sectionSummary,
    };
  } catch (error) {
    logger.error('CrmReachOutDigest', 'Digest run failed', {
      error: error.message,
      dateKey,
      persist: true,
      module: MODULE.SYSTEM,
    });
    throw error;
  } finally {
    if (!dryRun && !skipLock && !testMode) await releaseLock(lockKey);
  }
}

const init = () => {
  if (!isEnabled()) {
    logger.info('CrmReachOutDigest', 'CRM_REACH_OUT_DIGEST_ENABLED=false — cron not scheduled');
    return;
  }

  const schedule = (process.env.CRM_REACH_OUT_DIGEST_CRON || '0 19 * * *').trim();
  logger.debug('CrmReachOutDigest', `Scheduling daily call stats (${schedule} IST)`);
  cron.schedule(schedule, () => {
    runCrmReachOutDigest().catch((err) => {
      logger.error('CrmReachOutDigest', 'Scheduled digest failed', { error: err.message });
    });
  }, { timezone: 'Asia/Kolkata' });
};

module.exports = {
  init,
  runCrmReachOutDigest,
  buildDigestHtml,
  summarizeDailyCallStats,
  fetchAuditLogsForRep,
  fetchPipelineTotalsForRep,
  getRecipientEmail,
  getRecipientEmails,
  parseRecipientEmails,
  getFromEmail,
  REP_SECTIONS,
  STAT_ROWS,
};
