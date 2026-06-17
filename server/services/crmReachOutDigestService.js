const cron = require('node-cron');
const CRMAudit = require('../models/CRMAudit');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { dispatchEmailPayload } = require('./mailDriver');
const { resolvePrimaryCallAssigneeId } = require('../utils/primaryCallAssignee');
const { resolveSatyamSalesRepId } = require('../utils/bookedCallRepAssignment');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { getDateKey, todayStart, todayEnd, startOfDayFromKey, endOfDayFromKey } = require('../utils/attendanceDate');
const { getSharedRedis } = require('../utils/sharedRedis');
const logger = require('../utils/logger');
const { MODULE } = require('../../shared/systemLogContract');

const BYPASS = bypassOptions('crm-reach-out-digest');
const redis = getSharedRedis();

const SKIP_FIELDS = new Set([
  'updatedAt',
  'lockedBy',
  'lockedAt',
  'reminderSent',
  'notifiedOverdue',
  '__v',
]);

const FIELD_LABELS = {
  callStatus: 'Call status',
  leadStatus: 'Lead status',
  notes: 'Notes',
  pitchNotes: 'Pitch notes',
  nextFollowupDate: 'Follow-up date',
  nextFollowupTime: 'Follow-up time',
  assignedRepId: 'Assigned rep',
  source: 'Source',
  email: 'Email',
  phone: 'Phone',
  name: 'Name',
  contactCategory: 'Contact category',
  artistProject: 'Artist project',
  crmType: 'CRM type',
  tags: 'Tags',
  metadata: 'Metadata',
  __deleted__: 'Deleted',
};

const REP_SECTIONS = [
  {
    key: 'akash',
    title: 'Artist Calls',
    subtitle: 'Akash — artist bookings & artist CRM reach-outs',
    resolveUserId: resolvePrimaryCallAssigneeId,
  },
  {
    key: 'satyam',
    title: 'Sales & Other Calls',
    subtitle: 'Satyam — website book-a-call & sales CRM reach-outs',
    resolveUserId: resolveSatyamSalesRepId,
  },
];

const getRecipientEmail = () =>
  (process.env.CRM_REACH_OUT_DIGEST_EMAIL || process.env.ADMIN_EMAIL || '').trim();

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

const formatFieldLabel = (field) => FIELD_LABELS[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const formatTimeIst = (date) =>
  new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

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

async function fetchAuditsForRep(userId, rangeStart, rangeEnd) {
  const userIdStr = String(userId);
  const logs = await CRMAudit.find({
    userId: { $in: [userId, userIdStr] },
    timestamp: { $gte: rangeStart, $lte: rangeEnd },
    fieldChanged: { $nin: [...SKIP_FIELDS] },
  })
    .sort({ timestamp: 1 })
    .lean()
    .setOptions(BYPASS);

  const leadIds = [...new Set(logs.map((log) => String(log.leadId)).filter(Boolean))];
  const leads = leadIds.length
    ? await Lead.find({ _id: { $in: leadIds } })
      .select('name email phone callStatus leadStatus crmType artistProject source')
      .lean()
      .setOptions(BYPASS)
    : [];
  const leadMap = new Map(leads.map((lead) => [String(lead._id), lead]));

  return logs.map((log) => ({
    ...log,
    lead: log.leadId ? leadMap.get(String(log.leadId)) || null : null,
  }));
}

function summarizeRepActivity(audits) {
  const uniqueLeads = new Set(audits.map((log) => String(log.leadId)).filter(Boolean));
  const fieldCounts = {};
  for (const log of audits) {
    fieldCounts[log.fieldChanged] = (fieldCounts[log.fieldChanged] || 0) + 1;
  }
  return {
    totalChanges: audits.length,
    leadsTouched: uniqueLeads.size,
    fieldCounts,
  };
}

function buildRepSectionHtml(sectionMeta, repUser, audits) {
  const summary = summarizeRepActivity(audits);
  const repName = repUser?.name || sectionMeta.title;

  if (!audits.length) {
    return `
      <section style="margin:0 0 28px;padding:20px;border:1px solid #334155;border-radius:10px;background:#0f172a;">
        <h2 style="margin:0 0 4px;color:#2dd4bf;font-size:18px;">${escapeHtml(sectionMeta.title)}</h2>
        <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">${escapeHtml(sectionMeta.subtitle)} · ${escapeHtml(repName)}</p>
        <p style="margin:0;color:#64748b;font-size:14px;">No CRM updates recorded for this rep in this period.</p>
      </section>
    `;
  }

  const grouped = new Map();
  for (const log of audits) {
    const leadKey = log.leadId ? String(log.leadId) : 'unknown';
    if (!grouped.has(leadKey)) grouped.set(leadKey, { lead: log.lead, entries: [] });
    grouped.get(leadKey).entries.push(log);
  }

  const topFields = Object.entries(summary.fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => `${formatFieldLabel(field)} (${count})`)
    .join(' · ');

  const leadBlocks = [...grouped.values()].map(({ lead, entries }) => {
    const leadTitle = lead?.name || 'Unknown lead';
    const leadMeta = [
      lead?.phone,
      lead?.crmType,
      lead?.artistProject,
      lead?.callStatus,
      lead?.leadStatus,
    ].filter(Boolean).join(' · ');

    const rows = entries.map((entry) => `
      <tr>
        <td style="padding:8px 10px;color:#94a3b8;font-size:12px;white-space:nowrap;vertical-align:top;">${escapeHtml(formatTimeIst(entry.timestamp))}</td>
        <td style="padding:8px 10px;color:#cbd5e1;font-size:12px;vertical-align:top;">${escapeHtml(formatFieldLabel(entry.fieldChanged))}</td>
        <td style="padding:8px 10px;color:#64748b;font-size:12px;vertical-align:top;">${escapeHtml(entry.oldValue || '(empty)')}</td>
        <td style="padding:8px 10px;color:#34d399;font-size:12px;vertical-align:top;">${escapeHtml(entry.newValue || '(empty)')}</td>
      </tr>
    `).join('');

    return `
      <div style="margin:16px 0 0;padding:14px;border:1px solid #1e293b;border-radius:8px;background:#111827;">
        <p style="margin:0 0 4px;color:#f8fafc;font-size:14px;font-weight:600;">${escapeHtml(leadTitle)}</p>
        ${leadMeta ? `<p style="margin:0 0 10px;color:#64748b;font-size:12px;">${escapeHtml(leadMeta)}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding:6px 10px;color:#64748b;font-size:11px;text-transform:uppercase;">Time</th>
              <th align="left" style="padding:6px 10px;color:#64748b;font-size:11px;text-transform:uppercase;">Field</th>
              <th align="left" style="padding:6px 10px;color:#64748b;font-size:11px;text-transform:uppercase;">From</th>
              <th align="left" style="padding:6px 10px;color:#64748b;font-size:11px;text-transform:uppercase;">To</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  return `
    <section style="margin:0 0 28px;padding:20px;border:1px solid #334155;border-radius:10px;background:#0f172a;">
      <h2 style="margin:0 0 4px;color:#2dd4bf;font-size:18px;">${escapeHtml(sectionMeta.title)}</h2>
      <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">${escapeHtml(sectionMeta.subtitle)} · ${escapeHtml(repName)}</p>
      <p style="margin:0 0 4px;color:#e2e8f0;font-size:14px;">
        <strong>${summary.totalChanges}</strong> update${summary.totalChanges === 1 ? '' : 's'}
        across <strong>${summary.leadsTouched}</strong> lead${summary.leadsTouched === 1 ? '' : 's'}
      </p>
      ${topFields ? `<p style="margin:0 0 12px;color:#64748b;font-size:12px;">Top fields: ${escapeHtml(topFields)}</p>` : ''}
      ${leadBlocks}
    </section>
  `;
}

function buildDigestHtml({ periodLabel, sections, testMode = false }) {
  const body = sections.map(({ sectionMeta, repUser, audits }) =>
    buildRepSectionHtml(sectionMeta, repUser, audits)
  ).join('');

  const title = testMode ? 'CRM Reach-Out Update (Test)' : 'CRM Reach-Out Daily Update';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#cbd5e1;max-width:760px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:28px;">
      <h1 style="color:#f8fafc;margin:0 0 8px;font-size:22px;font-weight:600;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.5;">
        ${escapeHtml(periodLabel)} · Automated summary of Akash (artist calls) and Satyam (sales & other calls).
      </p>
      ${body}
      <p style="color:#64748b;font-size:12px;margin:24px 0 0;">This digest is generated from CRM audit logs in CoreKnot.</p>
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
        audits: [],
        error: `${sectionMeta.key} rep not found`,
      });
      continue;
    }

    const repUser = await User.findById(userId).select('name email').lean().setOptions(BYPASS);
    const audits = await fetchAuditsForRep(userId, rangeStart, rangeEnd);
    sections.push({ sectionMeta, repUser, audits });
  }

  return sections;
}

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

  const recipient = (recipientOverride || getRecipientEmail()).trim();
  if (!recipient) {
    logger.warn('CrmReachOutDigest', 'No CRM_REACH_OUT_DIGEST_EMAIL configured');
    return { sent: false, reason: 'missing_recipient' };
  }

  const { rangeStart, rangeEnd } = options.rangeStart && options.rangeEnd
    ? { rangeStart: options.rangeStart, rangeEnd: options.rangeEnd }
    : getLookbackRange(lookbackDays, dateKey);
  const periodLabel = formatPeriodLabel(lookbackDays, dateKey);
  const lockKey = `crm-reach-out-digest:${dateKey}:${lookbackDays}:${recipient}`;

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
    const subject = `${subjectPrefix}CRM reach-out update — ${periodLabel}`;

    const totals = sections.reduce((acc, section) => {
      acc.changes += section.audits.length;
      acc.leads += summarizeRepActivity(section.audits).leadsTouched;
      return acc;
    }, { changes: 0, leads: 0 });

    if (dryRun) {
      return {
        sent: false,
        dryRun: true,
        dateKey,
        lookbackDays,
        periodLabel,
        recipient,
        subject,
        totals,
        sections: sections.map(({ sectionMeta, repUser, audits, error }) => ({
          key: sectionMeta.key,
          rep: repUser?.name || null,
          changes: audits.length,
          error: error || null,
        })),
      };
    }

    await dispatchEmailPayload({
      to: recipient,
      subject,
      html,
      from: getFromEmail(),
    });

    logger.info('CrmReachOutDigest', 'Daily digest sent', {
      dateKey,
      recipient,
      totals,
      module: MODULE.SYSTEM,
    });

    return {
      sent: true,
      dateKey,
      recipient,
      totals,
      sections: sections.map(({ sectionMeta, repUser, audits }) => ({
        key: sectionMeta.key,
        rep: repUser?.name || null,
        changes: audits.length,
      })),
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
  logger.debug('CrmReachOutDigest', `Scheduling daily digest (${schedule} IST)`);
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
  fetchAuditsForRep,
  summarizeRepActivity,
  getRecipientEmail,
  getFromEmail,
  REP_SECTIONS,
};
