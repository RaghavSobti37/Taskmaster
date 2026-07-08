const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { syncCampaignOutcome, listCampaignSummaries } = require('./aisensyCampaignSyncService');
const { normalizeEmail, normalizePhone } = require('./havellsDataHubService');
const {
  inferStatusFromFilename,
  inferCampaignNameFromFilename,
} = require('./aisensyCampaignNameUtils');

const AISENSY_COLUMN_ALIASES = {
  name: ['name', 'user name', 'customer name', 'full name'],
  phone: ['mobile number', 'mobile', 'phone', 'phone number', 'whatsapp number', 'destination'],
  email: ['email', 'email id', 'e-mail'],
  sentAt: ['sent at', 'sent time', 'timestamp', 'date'],
  deliveredAt: ['delivered at', 'delivered_at'],
  readAt: ['read at', 'read_at'],
  clickedAt: ['link clicked at', 'clicked at', 'link click at'],
  failureReason: ['failure reason', 'reason', 'error', 'status reason', 'failed reason'],
  status: ['status', 'delivery status', 'message status'],
  tags: ['tags', 'tag', 'audience tags', 'segment'],
};

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function headerMap(row) {
  const map = new Map();
  for (const [k, v] of Object.entries(row || {})) {
    map.set(String(k || '').trim().toLowerCase(), v);
  }
  return map;
}

function pickColumn(row, aliases = []) {
  const lookup = headerMap(row);
  for (const key of aliases) {
    if (lookup.has(key.toLowerCase())) return lookup.get(key.toLowerCase());
  }
  return '';
}

async function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseDate(value) {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveRowStatus(row, defaultStatus) {
  const failureReason = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.failureReason));
  const statusText = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.status)).toLowerCase();
  const clickedAt = parseDate(pickColumn(row, AISENSY_COLUMN_ALIASES.clickedAt));
  const readAt = parseDate(pickColumn(row, AISENSY_COLUMN_ALIASES.readAt));
  const deliveredAt = parseDate(pickColumn(row, AISENSY_COLUMN_ALIASES.deliveredAt));
  const sentAt = parseDate(pickColumn(row, AISENSY_COLUMN_ALIASES.sentAt));

  let status = defaultStatus;
  if (clickedAt) status = 'clicked';
  else if (readAt) status = 'read';
  else if (deliveredAt) status = 'delivered';
  else if (failureReason || statusText.includes('fail')) status = 'failed';
  else if (statusText.includes('deliver')) status = 'delivered';
  else if (statusText.includes('read')) status = 'read';
  else if (statusText.includes('click')) status = 'clicked';
  else if (statusText.includes('repl')) status = 'replied';

  return { status, failureReason, sentAt, deliveredAt, readAt, clickedAt };
}

function mapAisensyRow(row, { defaultStatus }) {
  const name = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.name));
  const rawPhone = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.phone));
  const phone = normalizePhone(rawPhone);
  const email = normalizeEmail(pickColumn(row, AISENSY_COLUMN_ALIASES.email));
  const tagsRaw = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.tags));
  const tags = tagsRaw ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];
  const resolved = resolveRowStatus(row, defaultStatus);
  return {
    name: name || 'Anonymous',
    phone,
    email,
    status: resolved.status,
    failureReason: resolved.failureReason,
    sentAt: resolved.sentAt,
    tags,
    metadata: {
      deliveredAt: resolved.deliveredAt || undefined,
      readAt: resolved.readAt || undefined,
      clickedAt: resolved.clickedAt || undefined,
    },
    raw: row,
  };
}

async function importAisensyCampaignCsv({
  filePath,
  campaignName,
  defaultStatus,
  sourceFilename,
  tags = [],
  dryRun = false,
}) {
  const resolvedCampaign = campaignName || inferCampaignNameFromFilename(sourceFilename || filePath);
  const resolvedStatus = defaultStatus || inferStatusFromFilename(sourceFilename || filePath);
  const rows = await readCsvRows(filePath);
  const stats = {
    campaignName: resolvedCampaign,
    defaultStatus: resolvedStatus,
    rowsRead: rows.length,
    imported: 0,
    matchedPersonIndex: 0,
    skippedNoPhone: 0,
    errors: 0,
    dryRun,
  };

  for (const row of rows) {
    const mapped = mapAisensyRow(row, { defaultStatus: resolvedStatus });
    if (!mapped.phone) {
      stats.skippedNoPhone += 1;
      continue;
    }
    try {
      const result = await syncCampaignOutcome({
        campaignName: resolvedCampaign,
        phone: mapped.phone,
        name: mapped.name,
        email: mapped.email,
        status: mapped.status,
        failureReason: mapped.failureReason,
        sentAt: mapped.sentAt,
        tags: [...tags, ...(mapped.tags || [])],
        source: 'csv_import',
        sourceFilename: sourceFilename || path.basename(filePath),
        metadata: mapped.metadata,
        dryRun,
      });
      if (result.ok) {
        stats.imported += 1;
        if (result.personIndexId) stats.matchedPersonIndex += 1;
      }
    } catch {
      stats.errors += 1;
    }
  }
  return stats;
}

module.exports = {
  AISENSY_COLUMN_ALIASES,
  inferStatusFromFilename,
  inferCampaignNameFromFilename,
  mapAisensyRow,
  importAisensyCampaignCsv,
  listCampaignSummaries,
};
