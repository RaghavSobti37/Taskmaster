const axios = require('axios');
const { Readable } = require('stream');
const csvParser = require('csv-parser');
const { google } = require('googleapis');
const CRMImport = require('../../../models/CRMImport');
const ArtistPathResponse = require('../../../models/ArtistPathResponse');
const PersonIdentityService = require('../../../services/PersonIdentityService');
const PersonHubBuilder = require('../../../services/PersonHubBuilder');
const ContactService = require('../../../services/ContactService');
const { mapRowToArtistPath, buildSheetRowId, ARTIST_PATH_SHEET_ID, displayArtistLabel } = require('../../../../shared/artistPathSchema.cjs');
const logger = require('../../../utils/logger');
const { sendAiSensyMessage } = require('../../../utils/aisensyClient');

const HOLYSHEET_BASE = 'https://holysheet.soneshjain.com/api/v1';
const { getTenantId } = require('../../../utils/tenantContext');

const ARTIST_PATH_SHEET_HEADER = [
  'Timestamp', 'FullName', 'StageName', 'Place', 'Instagram', 'Spotify', 'Youtube', 'Mobile', 'Email',
  'ArtistIdentity', 'TrainingDetails', 'CoreSkills', 'StrengthsUniqueness', 'DailyTime', 'MentorName',
  'SongsReleased', 'ShowsPerformed', 'CurrentFans', 'CurrentSetup', 'CurrentlyWorkingOn', 'DailyRituals',
  'LearningNeeds', 'MentorshipNeeds', 'CurationNeeds', 'FandomNeeds', 'AspirationalGoal', 'AnythingElse',
];

let artistPathSheetHeaderChecked = false;

let cachedDefaultTenantId = null;

async function resolveTenantId() {
  const fromContext = getTenantId();
  if (fromContext) return fromContext;
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  const Tenant = require('../../../models/Tenant');
  let defaultTenant = await Tenant.findOne({ name: 'Default Tenant' });
  if (!defaultTenant) {
    defaultTenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'helloworld@theshakticollective',
    });
  }
  cachedDefaultTenantId = defaultTenant._id;
  return cachedDefaultTenantId;
}

function getArtistPathApiKey() {
  return process.env.HOLYSHEET_ARTIST_PATH_API_KEY
    || process.env.HOLYSHEET_API_KEY
    || process.env.HOLY_SHEET_API_KEY
    || '';
}

function getGoogleServiceAccount() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    .replace(/^"|"$/g, '');
  if (!clientEmail || !privateKey) return null;
  return { client_email: clientEmail, private_key: privateKey };
}

function formatSheetTimestamp(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function buildArtistPathSheetRow(rawPayload = {}, submittedAt = new Date()) {
  const row = normalizeWebhookPayload(rawPayload);
  return [
    row.Timestamp || row.timestamp || formatSheetTimestamp(submittedAt),
    row.FullName || '',
    row.StageName || '',
    row.Place || row.City || '',
    row.Instagram || '',
    row.Spotify || '',
    row.Youtube || '',
    row.Mobile || row.Phone || '',
    row.Email || '',
    row.ArtistIdentity || '',
    row.TrainingDetails || '',
    row.CoreSkills || '',
    row.StrengthsUniqueness || '',
    row.DailyTime || '',
    row.MentorName || '',
    row.SongsReleased || '',
    row.ShowsPerformed || '',
    row.CurrentFans || '',
    row.CurrentSetup || '',
    row.CurrentlyWorkingOn || '',
    row.DailyRituals || '',
    row.LearningNeeds || '',
    row.MentorshipNeeds || '',
    row.CurationNeeds || '',
    row.FandomNeeds || '',
    row.AspirationalGoal || '',
    row.AnythingElse || '',
  ];
}

async function getArtistPathSheetsClient() {
  const serviceAccount = getGoogleServiceAccount();
  if (!serviceAccount) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureArtistPathSheetHeader(sheets, spreadsheetId) {
  if (artistPathSheetHeaderChecked) return;
  const range = process.env.ARTIST_PATH_GOOGLE_SHEET_HEADER_RANGE || 'A1:AA1';
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const firstRow = response.data.values?.[0] || [];
  if (!firstRow.length || firstRow[0] !== 'Timestamp') {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [ARTIST_PATH_SHEET_HEADER] },
    });
  }
  artistPathSheetHeaderChecked = true;
}

async function appendArtistPathResponseToSheet(responseId, rawPayload, submittedAt) {
  if (!responseId) return { skipped: 'missing response id' };

  const claim = await ArtistPathResponse.updateOne(
    { _id: responseId, sheetSyncedAt: { $exists: false } },
    { $set: { sheetSyncStatus: 'pending' }, $unset: { sheetSyncError: '' } },
    { bypassTenant: true }
  );
  if (!claim.matchedCount) return { skipped: 'already synced' };

  const spreadsheetId = process.env.ARTIST_PATH_GOOGLE_SHEET_ID || ARTIST_PATH_SHEET_ID;
  const sheets = await getArtistPathSheetsClient();
  if (!sheets) {
    await ArtistPathResponse.updateOne(
      { _id: responseId },
      { $set: { sheetSyncStatus: 'failed', sheetSyncError: 'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY' } },
      { bypassTenant: true }
    );
    return { skipped: 'missing google service account' };
  }

  try {
    await ensureArtistPathSheetHeader(sheets, spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: process.env.ARTIST_PATH_GOOGLE_SHEET_APPEND_RANGE || 'A2',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [buildArtistPathSheetRow(rawPayload, submittedAt)] },
    });
    await ArtistPathResponse.updateOne(
      { _id: responseId },
      { $set: { sheetSyncedAt: new Date(), sheetSyncStatus: 'synced' }, $unset: { sheetSyncError: '' } },
      { bypassTenant: true }
    );
    return { synced: true };
  } catch (err) {
    await ArtistPathResponse.updateOne(
      { _id: responseId },
      { $set: { sheetSyncStatus: 'failed', sheetSyncError: err.message || 'Google Sheets append failed' } },
      { bypassTenant: true }
    );
    logger.warn('artistPathImport', 'Google Sheet append failed', { error: err.message, responseId });
    return { synced: false, error: err.message };
  }
}

/** Normalize website webhook JSON → HolySheet-style row keys */
function normalizeWebhookPayload(data = {}) {
  const row = { ...data };
  const aliases = {
    fullName: 'FullName',
    stageName: 'StageName',
    place: 'Place',
    city: 'Place',
    mobile: 'Mobile',
    phone: 'Mobile',
    email: 'Email',
    timestamp: 'Timestamp',
    artistIdentity: 'ArtistIdentity',
    instagram: 'Instagram',
    spotify: 'Spotify',
    youtube: 'Youtube',
    trainingDetails: 'TrainingDetails',
    coreSkills: 'CoreSkills',
    strengthsUniqueness: 'StrengthsUniqueness',
    dailyTime: 'DailyTime',
    mentorName: 'MentorName',
    songsReleased: 'SongsReleased',
    showsPerformed: 'ShowsPerformed',
    currentFans: 'CurrentFans',
    currentSetup: 'CurrentSetup',
    currentlyWorkingOn: 'CurrentlyWorkingOn',
    dailyRituals: 'DailyRituals',
    learningNeeds: 'LearningNeeds',
    mentorshipNeeds: 'MentorshipNeeds',
    curationNeeds: 'CurationNeeds',
    fandomNeeds: 'FandomNeeds',
    aspirationalGoal: 'AspirationalGoal',
    anythingElse: 'AnythingElse',
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (row[from] != null && row[from] !== '' && !row[to]) row[to] = row[from];
  }
  if (!row.FullName && (row.firstName || row.lastName)) {
    row.FullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
  }
  return row;
}

async function fetchHolySheetRows() {
  const apiKey = getArtistPathApiKey();
  if (!apiKey) return [];

  const sheetName = process.env.HOLYSHEET_ARTIST_PATH_SHEET || undefined;
  try {
    const params = sheetName ? { sheet: sheetName } : {};
    const res = await axios.get(`${HOLYSHEET_BASE}/${apiKey}/rows`, {
      params,
      timeout: 45000,
    });
    const rows = res.data?.data || [];
    logger.info('artistPathImport', 'HolySheet fetch ok', { count: rows.length, sheet: res.data?.sheet || sheetName || 'default' });
    return rows;
  } catch (err) {
    logger.warn('artistPathImport', 'HolySheet fetch failed', {
      error: err.message,
      status: err.response?.status,
    });
    return [];
  }
}

function sheetValuesToRows(values = []) {
  const [headerRow, ...dataRows] = values;
  const headers = (headerRow || []).map((header) => String(header || '').trim());
  if (!headers.length) return [];

  return dataRows
    .map((row) => headers.reduce((acc, header, index) => {
      if (!header) return acc;
      acc[header] = row?.[index] == null ? '' : String(row[index]).trim();
      return acc;
    }, {}))
    .filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));
}

async function fetchGoogleSheetRows() {
  const spreadsheetId = process.env.ARTIST_PATH_GOOGLE_SHEET_ID || ARTIST_PATH_SHEET_ID;
  const sheets = await getArtistPathSheetsClient();
  if (!sheets) return [];

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: process.env.ARTIST_PATH_GOOGLE_SHEET_READ_RANGE || 'A:AA',
    });
    const rows = sheetValuesToRows(response.data.values || []);
    logger.info('artistPathImport', 'Google Sheet fetch ok', { count: rows.length, spreadsheetId });
    return rows;
  } catch (err) {
    logger.warn('artistPathImport', 'Google Sheet fetch failed', {
      error: err.message,
      status: err.response?.status,
      spreadsheetId,
    });
    return [];
  }
}

function parseCsvRows(csvText = '') {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from([csvText])
      .pipe(csvParser())
      .on('data', (row) => {
        if (Object.values(row).some((value) => String(value || '').trim() !== '')) rows.push(row);
      })
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

async function fetchPublicGoogleSheetCsvRows() {
  const spreadsheetId = process.env.ARTIST_PATH_GOOGLE_SHEET_ID || ARTIST_PATH_SHEET_ID;
  const gid = process.env.ARTIST_PATH_GOOGLE_SHEET_GID || '0';
  try {
    const response = await axios.get(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`,
      {
        params: { format: 'csv', gid },
        responseType: 'text',
        timeout: 45000,
      }
    );
    const rows = await parseCsvRows(response.data || '');
    logger.info('artistPathImport', 'Public Google Sheet CSV fetch ok', { count: rows.length, spreadsheetId, gid });
    return rows;
  } catch (err) {
    logger.warn('artistPathImport', 'Public Google Sheet CSV fetch failed', {
      error: err.message,
      status: err.response?.status,
      spreadsheetId,
      gid,
    });
    return [];
  }
}

async function fetchSheetRows() {
  const holySheetRows = await fetchHolySheetRows();
  if (holySheetRows.length) return holySheetRows;
  const publicSheetRows = await fetchPublicGoogleSheetCsvRows();
  if (publicSheetRows.length) return publicSheetRows;
  return fetchGoogleSheetRows();
}

/**
 * Upsert one Artist Path response + Person spine (webhook or sheet row).
 * @returns {Promise<{ personId, responseId, email, name }|null>}
 */
async function upsertArtistPathRow(rawRow, { source = 'artist_path_sheet', sheetRowIdOverride } = {}) {
  const row = source === 'artist_path_webhook' ? normalizeWebhookPayload(rawRow) : rawRow;
  const { identity, answers, submittedAt, rowId, rawRow: mappedRaw } = mapRowToArtistPath(row);
  const email = identity.email || answers.email;
  const phone = identity.phone || answers.phone;
  const name = identity.name || answers.name || 'Anonymous';
  if (!email && !phone) return null;

  const resolved = await PersonIdentityService.resolvePerson(
    { name, email, phone, city: identity.city },
    { source: 'artist_path' }
  );
  if (!resolved) return null;

  const sheetRowId = sheetRowIdOverride
    || buildSheetRowId(row, { identity, answers, submittedAt, rowId, rawRow: mappedRaw })
    || rowId
    || row.rowId
    || row._id
    || row.id
    || `${email || phone}|${submittedAt?.toISOString?.() || Date.now()}`;
  const mergedAnswers = { ...answers, name, email, phone, city: identity.city };
  const tenantId = await resolveTenantId();

  const doc = await ArtistPathResponse.findOneAndUpdate(
    { sheetRowId: String(sheetRowId) },
    {
      $set: {
        personId: resolved.personId,
        submittedAt: submittedAt || new Date(),
        answers: mergedAnswers,
        rawRow: mappedRaw,
        source,
        tenantId,
      },
    },
    { upsert: true, returnDocument: 'after', bypassTenant: true }
  );

  await PersonIdentityService.linkSource(resolved.personId, 'artist_path', doc._id, mergedAnswers);
  await ContactService.mergeContact({
    name,
    email,
    phone,
    city: identity.city,
    recordId: doc._id,
    summary: { ...mergedAnswers, artistType: displayArtistLabel(mergedAnswers) },
    inletKey: 'artist_path',
  }, 'artist_path');
  await PersonHubBuilder.rebuildPerson(resolved.personId);

  return {
    personId: resolved.personId,
    responseId: doc._id,
    email,
    name,
    sheetRowId: String(sheetRowId),
  };
}

async function processArtistPathWebhook(data) {
  const payload = data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
    ? data.data
    : data;
  const result = await upsertArtistPathRow(payload, { source: 'artist_path_webhook' });
  if (!result) {
    throw new Error('Missing required identity: email or phone');
  }

  const normalized = normalizeWebhookPayload(payload);
  const mapped = mapRowToArtistPath(normalized);
  await appendArtistPathResponseToSheet(result.responseId, normalized, mapped.submittedAt || new Date());
  const firstName = String(payload.firstName || normalized.FullName || result.name || '').trim().split(' ')[0];
  const formattedFirstName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : 'Artist';
  const mobile = payload.mobile || normalized.Mobile || result.phone;

  if (mobile) {
    const campaignName = process.env.AISENSY_ARTIST_PATH_CAMPAIGN || 'Confirmation TSC';
    await sendAiSensyMessage(
      mobile,
      campaignName,
      [formattedFirstName],
      undefined,
      result.name || formattedFirstName
    );
  }

  return { success: true, message: 'Artist Path response recorded', ...result };
}

async function importRows(rows, { userId, filename = 'artist_path_holysheet_sync' } = {}) {
  const importSession = userId
    ? await CRMImport.create({
      filename,
      leadCount: rows.length,
      createdBy: userId,
    })
    : null;

  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const mapped = mapRowToArtistPath(rows[i]);
    const sheetRowIdOverride = buildSheetRowId(rows[i], mapped) || `sheet-row-${i}`;
    const result = await upsertArtistPathRow(rows[i], { source: 'artist_path_sheet', sheetRowIdOverride });
    if (!result) continue;
    if (importSession) {
      await ArtistPathResponse.updateOne(
        { _id: result.responseId },
        { $set: { importId: importSession._id } }
      );
    }
    imported++;
  }

  return { importId: importSession?._id, imported, total: rows.length };
}

async function syncFromSheet(options = {}) {
  const rows = await fetchSheetRows();
  if (!rows.length) {
    return {
      imported: 0,
      total: 0,
      message: 'No rows fetched - check HOLYSHEET_ARTIST_PATH_API_KEY or Google Sheets service-account env vars',
    };
  }
  return importRows(rows, { ...options, filename: 'artist_path_holysheet_sync' });
}

module.exports = {
  fetchSheetRows,
  fetchHolySheetRows,
  fetchGoogleSheetRows,
  fetchPublicGoogleSheetCsvRows,
  sheetValuesToRows,
  parseCsvRows,
  upsertArtistPathRow,
  processArtistPathWebhook,
  importRows,
  syncFromSheet,
  normalizeWebhookPayload,
  buildArtistPathSheetRow,
  appendArtistPathResponseToSheet,
  ARTIST_PATH_SHEET_ID,
};
