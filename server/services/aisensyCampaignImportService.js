const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { syncCampaignOutcome, listCampaignSummaries } = require('./aisensyCampaignSyncService');
const { normalizeEmail, normalizePhone } = require('./havellsDataHubService');

const AISENSY_COLUMN_ALIASES = {
  name: ['name', 'user name', 'customer name', 'full name'],
  phone: ['mobile number', 'mobile', 'phone', 'phone number', 'whatsapp number', 'destination'],
  email: ['email', 'email id', 'e-mail'],
  sentAt: ['sent at', 'sent time', 'timestamp', 'date'],
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

function inferStatusFromFilename(filename = '') {
  const lower = String(filename).toLowerCase();
  if (lower.includes('failed')) return 'failed';
  if (lower.includes('delivered')) return 'delivered';
  if (lower.includes('read')) return 'read';
  if (lower.includes('click')) return 'clicked';
  if (lower.includes('repl')) return 'replied';
  return 'sent';
}

function inferCampaignNameFromFilename(filename = '') {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/\s*(failed audience|failed|delivered audience|delivered|read audience|read|clicked|clicked audience|replied|replied audience|sent audience|sent)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function mapAisensyRow(row, { defaultStatus }) {
  const name = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.name));
  const rawPhone = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.phone));
  const phone = normalizePhone(rawPhone);
  const email = normalizeEmail(pickColumn(row, AISENSY_COLUMN_ALIASES.email));
  const failureReason = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.failureReason));
  const statusText = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.status)).toLowerCase();
  const tagsRaw = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.tags));
  const tags = tagsRaw ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];
  let status = defaultStatus;
  if (statusText.includes('fail')) status = 'failed';
  else if (statusText.includes('deliver')) status = 'delivered';
  else if (statusText.includes('read')) status = 'read';
  else if (statusText.includes('click')) status = 'clicked';
  else if (statusText.includes('repl')) status = 'replied';
  const sentAtRaw = clean(pickColumn(row, AISENSY_COLUMN_ALIASES.sentAt));
  const sentAt = sentAtRaw ? new Date(sentAtRaw) : null;
  return {
    name: name || 'Anonymous',
    phone,
    email,
    status,
    failureReason,
    sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
    tags,
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
