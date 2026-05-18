const { google } = require('googleapis');
const Lead = require('../models/Lead');

const HEADERS = [
  'rowId', 'customerIdExly', 'transactionIdExly', 'name', 'email', 'phone', 
  'webinarDates', 'attended', 'attendanceDurationMin', 'qnaAnswered', 
  'artistType', 'fullTimeWillingness', 'primaryRole', 'learningGoal', 
  'learnedMusic', 'currentJourney', 'meaningfulConnect', 'leadQuality', 
  'callStatus', 'leadStatus', 'remarks', 'source', 'planOption', 
  'nextFollowupDate', 'nextFollowupTime', 'assignedRepId', '_id', 
  'createdAt', 'updatedAt'
];

function getAuthClient() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key || email.includes('your-service-account')) {
    return null;
  }
  if (email.startsWith('"') && email.endsWith('"')) email = email.slice(1, -1);
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  key = key.replace(/\\n/g, '\n');

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

const extractCell = (doc, key) => {
  if (!doc) return '';
  const val = doc[key];
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.toString();
  return String(val);
};

const formatLeadArray = (doc) => {
  return HEADERS.map(h => extractCell(doc, h));
};

exports.syncLeadToSheet = async (leadDoc) => {
  try {
    const auth = getAuthClient();
    if (!auth) return;

    let spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (spreadsheetId && spreadsheetId.startsWith('"') && spreadsheetId.endsWith('"')) {
      spreadsheetId = spreadsheetId.slice(1, -1);
    }
    if (!spreadsheetId) return;

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 1. Get existing rows to find if lead exists
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:AC'
    }).catch(() => ({ data: { values: [] } }));

    const rows = response.data.values || [];
    const newRow = formatLeadArray(leadDoc);

    // If sheet is completely empty, write headers first
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [HEADERS, newRow] }
      });
      console.log(`[GoogleSheets] Initialized sheet and synced lead ${leadDoc.name}`);
      return;
    }

    // Check if phone or _id matches
    const idIndex = HEADERS.indexOf('_id');
    const phoneIndex = HEADERS.indexOf('phone');

    let targetIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if ((row[idIndex] && String(row[idIndex]) === String(leadDoc._id)) ||
          (row[phoneIndex] && String(row[phoneIndex]) === String(leadDoc.phone))) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== -1) {
      // Update specific row (1-indexed row number is targetIndex + 1)
      const rowNum = targetIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Sheet1!A${rowNum}:AC${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] }
      });
      console.log(`[GoogleSheets] Updated lead ${leadDoc.name} at row ${rowNum}`);
    } else {
      // Append row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:A',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });
      console.log(`[GoogleSheets] Appended new lead ${leadDoc.name}`);
    }
  } catch (err) {
    console.error(`[GoogleSheets Sync Error] Failed to sync lead: ${err.message}`);
  }
};

exports.backupAllLeads = async () => {
  try {
    const auth = getAuthClient();
    if (!auth) {
      console.error('[GoogleSheets Backup] Service account credentials not configured.');
      return;
    }

    let spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (spreadsheetId && spreadsheetId.startsWith('"') && spreadsheetId.endsWith('"')) {
      spreadsheetId = spreadsheetId.slice(1, -1);
    }
    if (!spreadsheetId) return;

    const sheets = google.sheets({ version: 'v4', auth });
    const leads = await Lead.find({}).lean();
    const dataRows = leads.map(formatLeadArray);
    const values = [HEADERS, ...dataRows];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
    console.log(`[GoogleSheets] Successfully backed up all ${leads.length} leads.`);
  } catch (err) {
    console.error(`[GoogleSheets Backup Error] ${err.message}`);
  }
};
