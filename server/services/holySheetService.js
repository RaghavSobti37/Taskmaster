const axios = require('axios');
const BASE_URL = 'https://holysheet.soneshjain.com/api/v1';

let consecutiveErrors = 0;
let circuitOpenUntil = 0;

const isCircuitOpen = () => {
  if (Date.now() < circuitOpenUntil) {
    console.warn('[Circuit Breaker] HolySheet sync skipped. Circuit is open.');
    return true;
  }
  return false;
};

const recordError = () => {
  consecutiveErrors++;
  if (consecutiveErrors >= 3) {
    circuitOpenUntil = Date.now() + 5 * 60 * 1000; // Open for 5 mins
    console.error('[Circuit Breaker] HolySheet API failed 3 times. Circuit opened for 5 minutes.');
  }
};

const recordSuccess = () => {
  consecutiveErrors = 0;
  circuitOpenUntil = 0;
};

const HEADERS = [
  'rowId', 'customerIdExly', 'transactionIdExly', 'name', 'email', 'phone', 'city',
  'webinarDates', 'attended', 'attendanceDurationMin', 'qnaAnswered', 
  'artistType', 'fullTimeWillingness', 'primaryRole', 'learningGoal', 
  'learnedMusic', 'currentJourney', 'meaningfulConnect', 'leadQuality', 
  'callStatus', 'leadStatus', 'remarks', 'source', 'planOption', 
  'nextFollowupDate', 'nextFollowupTime', 'assignedRepId', '_id', 
  'createdAt', 'updatedAt'
];

const extractCell = (doc, key) => {
  if (!doc) return '';
  const val = doc[key];
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.toString();
  return String(val);
};

exports.syncLeadToSheet = async (leadDoc) => {
  if (isCircuitOpen()) return;
  try {
    const apiKey = process.env.HOLYSHEET_API_KEY || process.env.HOLY_SHEET_API_KEY || 'A4NWMO7Hr9zJGlf1epJAOGzp0mzBfLMH';
    if (!apiKey) return;

    const sheetName = 'All Data Backup';

    // 1. Construct values object
    const values = {};
    for (const h of HEADERS) {
      values[h] = extractCell(leadDoc, h);
    }

    // 2. Fetch existing rows to check for match
    let rows = [];
    try {
      const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
      rows = getRes.data?.data || [];
    } catch (err) {
      console.warn('[HolySheet Backup Warn] Failed to fetch rows, attempting append. Error:', err.message);
    }

    let targetIndex = -1;
    const docId = leadDoc._id ? String(leadDoc._id).trim() : '';
    const docEmail = leadDoc.email ? String(leadDoc.email).trim().toLowerCase() : '';
    const docPhone = leadDoc.phone ? String(leadDoc.phone).trim() : '';
    const docRowId = leadDoc.rowId ? String(leadDoc.rowId).trim() : '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sheetId = row['_id'] ? String(row['_id']).trim() : '';
      const sheetEmail = row['email'] ? String(row['email']).trim().toLowerCase() : '';
      const sheetPhone = row['phone'] ? String(row['phone']).trim() : '';
      const sheetRowId = row['rowId'] ? String(row['rowId']).trim() : '';

      if (sheetId && docId && sheetId === docId) { targetIndex = i; break; }
      if (docEmail && sheetEmail === docEmail) { targetIndex = i; break; }
      if (!docEmail && docPhone && sheetPhone === docPhone) { targetIndex = i; break; }
      if (!docEmail && !docPhone && docRowId && sheetRowId === docRowId) { targetIndex = i; break; }
    }

    if (targetIndex !== -1) {
      // Update specific row (1-indexed row number is targetIndex + 2 since 1 is header)
      const rowIndex = targetIndex + 2;
      await axios.patch(`${BASE_URL}/${apiKey}/rows`, {
        sheet: sheetName,
        rowIndex,
        values
      });
      console.log(`[HolySheet Backup] Successfully updated lead ${leadDoc.name} on row ${rowIndex}`);
    } else {
      // Append new row as pure values array to avoid pushing column names
      const rowValues = HEADERS.map(h => extractCell(leadDoc, h));
      await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [rowValues] }, { params: { sheet: sheetName } });
      console.log(`[HolySheet Backup] Successfully appended new lead ${leadDoc.name} to HolySheet`);
    }
    recordSuccess();
  } catch (error) {
    recordError();
    console.error('[HolySheet Backup Error]', error.message, error.response?.data || '');
  }
};

exports.backupAllLeads = async () => {
  try {
    const apiKey = process.env.HOLYSHEET_API_KEY || process.env.HOLY_SHEET_API_KEY || 'A4NWMO7Hr9zJGlf1epJAOGzp0mzBfLMH';
    if (!apiKey) return;
    const sheetName = 'All Data Backup';
    const Lead = require('../models/Lead');
    const leads = await Lead.find({}).lean();
    console.log(`[HolySheet Backup] Found ${leads.length} leads in database. Starting batch sync...`);

    // Fetch existing rows
    let existingRows = [];
    try {
      const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
      existingRows = getRes.data?.data || [];
      if (existingRows.length === 0 && (getRes.data?.count === 0 || !getRes.data)) {
        await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [HEADERS] }, { params: { sheet: sheetName } });
        console.log('[HolySheet Backup] Initialized header row on empty sheet.');
      }
    } catch (err) {
      console.warn('[HolySheet Backup Warn] Check header error:', err.message);
    }

    const existingCount = existingRows.length;
    console.log(`[HolySheet Backup] Existing rows count: ${existingCount}`);

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (i < existingCount) {
        const values = {};
        for (const h of HEADERS) values[h] = extractCell(lead, h);
        await axios.patch(`${BASE_URL}/${apiKey}/rows`, {
          sheet: sheetName,
          rowIndex: i + 2,
          values
        });
        if ((i + 1) % 50 === 0) {
          console.log(`[HolySheet Backup] Updated ${i + 1}/${existingCount} existing rows...`);
        }
        await new Promise(r => setTimeout(r, 60)); // 60ms delay to prevent server 500 rate limit
      } else {
        const remainingLeads = leads.slice(i);
        console.log(`[HolySheet Backup] Batch posting remaining ${remainingLeads.length} leads...`);
        const batches = [];
        for (let j = 0; j < remainingLeads.length; j += 100) {
          batches.push(remainingLeads.slice(j, j + 100));
        }
        for (let k = 0; k < batches.length; k++) {
          const batch = batches[k];
          const rowsToAppend = batch.map(l => HEADERS.map(h => extractCell(l, h)));
          await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: rowsToAppend }, { params: { sheet: sheetName } });
          console.log(`[HolySheet Backup] Batch ${k + 1}/${batches.length} successfully appended.`);
          await new Promise(r => setTimeout(r, 500));
        }
        break;
      }
    }
    console.log('[HolySheet Backup] Batch sync complete.');
  } catch (err) {
    console.error('[HolySheet Backup Batch Error]', err.message);
  }
};

exports.syncUnsubscribeToSheet = async ({ email, name, campaignId, reason, unsubscribedAt }) => {
  try {
    const apiKey = process.env.HOLYSHEET_UNSUBSCRIBED_API_KEY || '3ALHde5tX9ZFocmCJ0GJdhqXSMEKgb9l';
    const sheetName = 'Sheet1';

    // Verify or initialize header row first
    let existingRows = [];
    try {
      const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
      existingRows = getRes.data?.data || [];
      if (existingRows.length === 0 && (getRes.data?.count === 0 || !getRes.data)) {
        await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [['email', 'name', 'campaign_id', 'reason', 'unsubscribed_at']] }, { params: { sheet: sheetName } });
        console.log('[HolySheet Unsubscribe] Initialized header row.');
      }
    } catch (err) {
      console.warn('[HolySheet Unsubscribe Warn] Check header error:', err.message);
    }

    const rowValues = [
      email || '',
      name || '',
      campaignId || '',
      reason || '',
      unsubscribedAt ? new Date(unsubscribedAt).toISOString() : new Date().toISOString()
    ];

    await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [rowValues] }, { params: { sheet: sheetName } });
    console.log(`[HolySheet Unsubscribe] Successfully synced unsubscribed lead ${email} to sheet`);
  } catch (error) {
    console.error('[HolySheet Unsubscribe Error]', error.message, error.response?.data || '');
  }
};

exports.syncAndCleanUnsubscribeSheet = async () => {
  try {
    const Lead = require('../models/Lead');
    const apiKey = process.env.HOLYSHEET_UNSUBSCRIBED_API_KEY || '3ALHde5tX9ZFocmCJ0GJdhqXSMEKgb9l';
    const sheetName = 'Sheet1';

    // 1. Fetch all unsubscribed leads from local DB
    const dbUnsubs = await Lead.find({
      $or: [
        { unsubscribed: true },
        { emailStatus: 'Unsubscribed' }
      ]
    }).lean();

    // 2. Fetch all existing rows from the Google Sheet
    let sheetRows = [];
    try {
      const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
      sheetRows = getRes.data?.data || [];
    } catch (err) {
      console.warn('[HolySheet Sync] Failed to fetch existing rows from sheet:', err.message);
    }

    // 3. Merge and deduplicate by email (case-insensitive)
    const mergedMap = new Map();

    // First load sheet rows
    sheetRows.forEach(row => {
      if (row && row.email) {
        const emailKey = row.email.toLowerCase().trim();
        if (emailKey) {
          mergedMap.set(emailKey, {
            email: emailKey,
            name: row.name || '',
            campaign_id: row.campaign_id || '',
            reason: row.reason || 'Opt-out',
            unsubscribed_at: row.unsubscribed_at || new Date().toISOString()
          });
        }
      }
    });

    // Next load DB unsubs (giving preference to existing info or adding if new)
    dbUnsubs.forEach(lead => {
      if (lead && lead.email) {
        const emailKey = lead.email.toLowerCase().trim();
        if (emailKey) {
          const existing = mergedMap.get(emailKey);
          mergedMap.set(emailKey, {
            email: emailKey,
            name: existing?.name || lead.name || '',
            campaign_id: existing?.campaign_id || '',
            reason: existing?.reason || lead.unsubscribeReason || 'Opt-out',
            unsubscribed_at: existing?.unsubscribed_at || lead.updatedAt || new Date().toISOString()
          });
        }
      }
    });

    const uniqueUnsubs = Array.from(mergedMap.values());
    console.log(`[HolySheet Sync] Unified list has ${uniqueUnsubs.length} unique unsubscribed entries. (Previous sheet rows: ${sheetRows.length})`);

    // 4. Overwrite/update Google Sheet rows
    // Row 1 is header: we ensure it's correct
    try {
      if (sheetRows.length === 0) {
        await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [['email', 'name', 'campaign_id', 'reason', 'unsubscribed_at']] }, { params: { sheet: sheetName } });
      }
    } catch (err) {
      console.warn('[HolySheet Sync] Header init error:', err.message);
    }

    // Update first N rows (from rowIndex 2 onwards)
    for (let i = 0; i < uniqueUnsubs.length; i++) {
      const entry = uniqueUnsubs[i];
      const rowIndex = i + 2;
      const values = {
        email: entry.email,
        name: entry.name,
        campaign_id: entry.campaign_id,
        reason: entry.reason,
        unsubscribed_at: entry.unsubscribed_at
      };
      await axios.patch(`${BASE_URL}/${apiKey}/rows`, {
        sheet: sheetName,
        rowIndex,
        values
      });
    }

    // Clear any leftover/stale rows in Google Sheet (indices from uniqueUnsubs.length + 2 to sheetRows.length + 1)
    const previousTotalRows = sheetRows.length;
    if (previousTotalRows > uniqueUnsubs.length) {
      for (let rowIndex = uniqueUnsubs.length + 2; rowIndex <= previousTotalRows + 1; rowIndex++) {
        await axios.patch(`${BASE_URL}/${apiKey}/rows`, {
          sheet: sheetName,
          rowIndex,
          values: {
            email: '',
            name: '',
            campaign_id: '',
            reason: '',
            unsubscribed_at: ''
          }
        });
      }
      console.log(`[HolySheet Sync] Cleared ${previousTotalRows - uniqueUnsubs.length} extra rows in sheet.`);
    }

    // 5. Update local database to match the Google Sheet
    for (const entry of uniqueUnsubs) {
      await Lead.updateMany(
        { email: entry.email },
        {
          $set: {
            unsubscribed: true,
            unsubscribeReason: entry.reason || 'Opt-out',
            emailStatus: 'Unsubscribed',
            status: 'inactive'
          }
        }
      );
    }

    console.log('[HolySheet Sync] Deduplication and sync completed successfully.');
    return uniqueUnsubs;
  } catch (error) {
    console.error('[HolySheet Sync Error]', error.message, error.response?.data || '');
    throw error;
  }
};

exports.pullUnsubscribedFromSheet = async () => {
  try {
    const Lead = require('../models/Lead');
    const apiKey = process.env.HOLYSHEET_UNSUBSCRIBED_API_KEY || '3ALHde5tX9ZFocmCJ0GJdhqXSMEKgb9l';
    const sheetName = 'Sheet1';

    const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
    const sheetRows = getRes.data?.data || [];
    
    console.log(`[HolySheet Pull] Fetched ${sheetRows.length} unsubscribed rows from Google Sheets.`);

    let updateCount = 0;
    for (const row of sheetRows) {
      if (row && row.email) {
        const email = row.email.toLowerCase().trim();
        if (email) {
          const res = await Lead.updateMany(
            { email, unsubscribed: { $ne: true } },
            {
              $set: {
                unsubscribed: true,
                unsubscribeReason: row.reason || 'Opt-out',
                emailStatus: 'Unsubscribed',
                status: 'inactive'
              }
            }
          );
          if (res.modifiedCount > 0) {
            updateCount += res.modifiedCount;
          }
        }
      }
    }
    if (updateCount > 0) {
      console.log(`[HolySheet Pull] Synced ${updateCount} new unsubscribed leads to database.`);
    }
  } catch (err) {
    console.error('[HolySheet Pull Error]', err.message);
  }
};
