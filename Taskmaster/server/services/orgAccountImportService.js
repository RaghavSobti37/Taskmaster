const { google } = require('googleapis');
const OrgAccount = require('../models/OrgAccount');
const Project = require('../models/Project');

const SPREADSHEET_ID = '1hbuwbSVNTv01RBgwLxZo8aTOmzTuIkxuOYvSBUhbhrc';

const PLATFORM_ALIASES = {
  ig: 'Instagram',
  insta: 'Instagram',
  instagram: 'Instagram',
  threads: 'Threads',
  yt: 'YouTube',
  youtube: 'YouTube',
  fb: 'Facebook',
  facebook: 'Facebook',
  spotify: 'Spotify',
  twitter: 'Twitter/X',
  'x (twitter)': 'Twitter/X',
  x: 'Twitter/X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  patreon: 'Patreon',
  snapchat: 'Snapchat',
  email: 'Email',
  exly: 'Exly',
  google: 'Google Workspace',
  gmail: 'Google Workspace',
  'google workspace': 'Google Workspace',
  notion: 'Notion',
  canva: 'Canva',
  zoom: 'Zoom',
};

const SOCIAL_RE = /instagram|threads|youtube|facebook|spotify|tiktok|twitter|linkedin|reddit|patreon|snapchat|^x$/i;
const EMAIL_RE = /^email$|mail/i;
const PLATFORM_RE = /exly|notion|canva|zoom|google|gmail|workspace|saas|platform/i;

function normalizeHeader(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function cell(row, idx) {
  if (idx < 0 || !row) return '';
  const val = row[idx];
  return val != null ? String(val).trim() : '';
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

function extractUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s,)]+/i);
  return match ? match[0].replace(/[.,;)]+$/, '') : '';
}

function normalizePlatform(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'Other';
  const key = text.toLowerCase();
  return PLATFORM_ALIASES[key] || text;
}

function inferCategory(platform, { loginEmail, identifier } = {}) {
  const p = String(platform || '').toLowerCase();
  if (EMAIL_RE.test(p) || (loginEmail && !SOCIAL_RE.test(p))) return 'email';
  if (SOCIAL_RE.test(p)) return 'social';
  if (PLATFORM_RE.test(p)) return 'platform';
  if (identifier && identifier.includes('@')) return 'email';
  return 'other';
}

function findCredentialHeaderRow(rows) {
  return rows.findIndex((row) => {
    const headers = (row || []).map(normalizeHeader);
    const hasProfile = headers.some((h) => h === 'profile');
    const hasCredentials = headers.some((h) => h === 'credentials' || h === 'credential');
    return hasProfile && hasCredentials;
  });
}

function findCredentialColumns(headers) {
  const idx = (patterns) => headers.findIndex((h) => patterns.some((p) => p.test(h)));

  return {
    serial: idx([/^s\.?\s*no\.?$/]),
    profile: idx([/^profile$/]),
    credentials: idx([/^credentials?$/, /^credential$/]),
    links: idx([/^links?$/]),
    remarks: idx([/^remarks?$/, /^notes?$/]),
  };
}

/**
 * Parse TSC credentials cell text, e.g.:
 *   "username- the_shakti_collective"
 *   "Pass- shakti7089"
 *   "id- DivineHanuman1\npassword- Divinehanuman@shakti"
 *   "email- user@example.com"
 */
function parseCredentialBlock(text) {
  const identifierParts = [];
  let loginEmail = '';
  let password = '';

  const lines = String(text || '')
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.;])\s+/))
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const passMatch = line.match(/^(?:password|pass|pwd)\s*[-:–]\s*(.+)$/i);
    if (passMatch) {
      password = passMatch[1].trim();
      continue;
    }

    const labeledMatch = line.match(/^(?:username|user(?:name)?|id|handle|email|login)\s*[-:–]\s*(.+)$/i);
    if (labeledMatch) {
      const val = labeledMatch[1].trim();
      if (val.includes('@')) loginEmail = val;
      else identifierParts.push(val);
      continue;
    }

    if (/^id[-–]/.test(line) && line.includes('@')) {
      const email = line.match(/([\w.+-]+@[\w.-]+)/);
      if (email) loginEmail = email[1];
      continue;
    }

    if (/^(?:id|username)\b/i.test(line)) {
      const val = line.replace(/^(?:id|username)\s*[-:–]?\s*/i, '').trim();
      if (val) identifierParts.push(val);
      continue;
    }

    if (!password && /^pass\b/i.test(line)) {
      password = line.replace(/^pass\s*[-:–]?\s*/i, '').trim();
      continue;
    }

    if (line.includes('@')) {
      const email = line.match(/([\w.+-]+@[\w.-]+)/);
      if (email) {
        if (!loginEmail) {
          loginEmail = email[1];
          continue;
        }
        if (!password) {
          password = line.trim();
          continue;
        }
      }
    }

    if (!password && (loginEmail || identifierParts.length)) {
      password = line.trim();
    }
  }

  return {
    identifier: identifierParts.join(' · '),
    loginEmail,
    password,
  };
}

function buildAccountFromEntry({ sheetName, platform, credentialText, linksText, remarksText }) {
  const normalizedPlatform = normalizePlatform(platform);
  const { identifier, loginEmail, password } = parseCredentialBlock(credentialText);
  const url = extractUrl(linksText);
  const notes = String(remarksText || '').trim();
  const category = inferCategory(normalizedPlatform, { loginEmail, identifier });

  return {
    label: `${sheetName} — ${normalizedPlatform}`,
    category,
    platform: normalizedPlatform,
    identifier,
    loginEmail,
    url,
    secret: password,
    notes: notes || undefined,
    status: 'active',
    sheetName,
    projectHint: sheetName,
  };
}

function parseStandardCredentialSheet(sheetName, rows) {
  const headerRowIdx = findCredentialHeaderRow(rows);
  if (headerRowIdx < 0) return [];

  const cols = findCredentialColumns(rows[headerRowIdx].map(normalizeHeader));
  if (cols.profile < 0 || cols.credentials < 0) return [];

  const accounts = [];
  let pending = null;

  const flushPending = () => {
    if (!pending) return;
    const credentialText = pending.credentialParts.filter(Boolean).join('\n');
    if (!credentialText && !pending.linksText && !pending.remarksText) {
      pending = null;
      return;
    }
    accounts.push(buildAccountFromEntry({
      sheetName,
      platform: pending.platform,
      credentialText,
      linksText: pending.linksText,
      remarksText: pending.remarksText,
    }));
    pending = null;
  };

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some((c) => String(c || '').trim())) continue;

    const profile = cell(row, cols.profile);
    const credentials = cell(row, cols.credentials);
    const links = cell(row, cols.links);
    const remarks = cell(row, cols.remarks);

    if (profile) {
      flushPending();
      pending = {
        platform: profile,
        credentialParts: credentials ? [credentials] : [],
        linksText: links,
        remarksText: remarks,
      };
      continue;
    }

    if (pending) {
      if (credentials) pending.credentialParts.push(credentials);
      if (links) pending.linksText = [pending.linksText, links].filter(Boolean).join('\n');
      if (remarks) pending.remarksText = [pending.remarksText, remarks].filter(Boolean).join('\n');
    }
  }

  flushPending();
  return accounts;
}

/** More IDs tab: S.no | Label | Credential col with password continuation rows */
function parseMoreIdsSheet(sheetName, rows) {
  const headerRowIdx = rows.findIndex((row) =>
    (row || []).some((c) => /^s\.?\s*no\.?$/i.test(String(c || '').trim()))
  );
  if (headerRowIdx < 0) return [];

  const header = rows[headerRowIdx].map(normalizeHeader);
  if (header.some((h) => h === 'profile' && header.some((x) => x === 'credentials'))) return [];

  const labelCol = header.findIndex((h) => h === 'profile') >= 0
    ? header.findIndex((h) => h === 'profile')
    : 1;
  const credCol = header.findIndex((h) => h === 'credentials') >= 0
    ? header.findIndex((h) => h === 'credentials')
    : Math.max(2, header.length - 1);

  const accounts = [];
  let pending = null;

  const flush = () => {
    if (!pending?.platform) return;
    accounts.push(buildAccountFromEntry({
      sheetName,
      platform: pending.platform,
      credentialText: pending.credentialParts.join('\n'),
      linksText: '',
      remarksText: '',
    }));
    pending = null;
  };

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some((c) => String(c || '').trim())) {
      flush();
      continue;
    }

    const label = cell(row, labelCol);
    const cred = cell(row, credCol);

    if (label) {
      flush();
      pending = { platform: label, credentialParts: cred ? [cred] : [] };
    } else if (pending && cred) {
      pending.credentialParts.push(cred);
    }
  }
  flush();
  return accounts;
}

/** Dattadham-style key/value blocks separated by blank rows */
function parseKeyValueBlocksSheet(sheetName, rows) {
  const accounts = [];
  let blockTitle = sheetName;
  let credentialLines = [];

  const flushBlock = () => {
    if (!credentialLines.length) return;
    const platform = blockTitle || sheetName;
    accounts.push(buildAccountFromEntry({
      sheetName,
      platform,
      credentialText: credentialLines.join('\n'),
      linksText: '',
      remarksText: '',
    }));
    credentialLines = [];
  };

  for (const row of rows) {
    if (!row || !row.some((c) => String(c || '').trim())) {
      flushBlock();
      blockTitle = sheetName;
      continue;
    }

    const key = String(row[0] || '').trim();
    const value = String(row[1] || row[2] || '').trim();
    const keyNorm = key.toLowerCase();

    if (!value && row.length === 1) {
      blockTitle = key;
      continue;
    }

    if (/^(id|email)$/i.test(keyNorm)) {
      credentialLines.push(value.includes('@') ? `email- ${value.replace(/^email-?\s*/i, '')}` : `id- ${value}`);
    } else if (/^password$/i.test(keyNorm)) {
      credentialLines.push(`password- ${value}`);
    } else if (/^username$/i.test(keyNorm)) {
      credentialLines.push(`username- ${value}`);
    } else if (value.includes('@')) {
      credentialLines.push(`email- ${value.replace(/^email-?\s*/i, '')}`);
      if (!/^(id|email|password|username)$/i.test(key)) blockTitle = key;
    } else if (key && value) {
      blockTitle = key;
      credentialLines.push(`${key}- ${value}`);
    } else if (key && !value) {
      blockTitle = key;
    }
  }

  flushBlock();
  return accounts;
}

/**
 * TSC credentials sheet layouts:
 * 1. Standard: S.no | Profile | Credentials | Links | REMARKS
 * 2. More IDs: S.no | Label | Credential (multi-row passwords)
 * 3. Key/value blocks: Dattadham-style ID/PASSWORD pairs
 */
function parseRowsFromSheet(sheetName, rows) {
  if (!rows.length) return [];

  const standard = parseStandardCredentialSheet(sheetName, rows);
  if (standard.length) return standard;

  const moreIds = parseMoreIdsSheet(sheetName, rows);
  if (moreIds.length) return moreIds;

  return parseKeyValueBlocksSheet(sheetName, rows);
}

function resolveProjectIds(projectHint, projects) {
  if (!projectHint) return [];
  const hint = projectHint.trim().toLowerCase();
  if (!hint) return [];

  const exact = projects.filter((p) => String(p.name || '').trim().toLowerCase() === hint);
  if (exact.length) return exact.map((p) => p._id);

  const partial = projects.filter((p) => {
    const name = String(p.name || '').toLowerCase();
    const workspace = String(p.workspace || '').toLowerCase();
    return name.includes(hint) || hint.includes(name) || workspace.includes(hint) || hint.includes(workspace);
  });

  return partial.map((p) => p._id);
}

const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  || 'tsc-newsletter@tsc-website-470512.iam.gserviceaccount.com';

async function getSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error(sheetAccessHelpMessage('Google service account credentials are missing.'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    return { sheets, mode: 'service_account' };
  } catch (err) {
    const msg = String(err.message || '');
    if (/permission|403|404|not found/i.test(msg)) {
      throw new Error(sheetAccessHelpMessage('Service account cannot read this sheet yet.'));
    }
    throw err;
  }
}

async function fetchSheetData(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tabNames = meta.data.sheets.map((s) => s.properties.title);
  const batch = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: tabNames.map((t) => `'${t.replace(/'/g, "''")}'!A:Z`),
  });

  return batch.data.valueRanges.map((rangeData, i) => {
    const sheetName = tabNames[i];
    const rows = rangeData.values || [];
    return {
      sheetName,
      rows,
      accounts: parseRowsFromSheet(sheetName, rows),
    };
  });
}

async function importOrgAccountsFromSheet({ user, dryRun = false, replaceExisting = true } = {}) {
  const { sheets, mode } = await getSheetsClient();
  const sheetData = await fetchSheetData(sheets);
  const projects = await Project.find({}).select('name workspace').lean();

  let deleted = 0;
  let created = 0;
  const details = [];

  if (!dryRun && replaceExisting) {
    const result = await OrgAccount.deleteMany({ tenantId: user.tenantId });
    deleted = result.deletedCount || 0;
    details.push({ action: 'cleared', count: deleted });
  }

  for (const { sheetName, accounts, rows } of sheetData) {
    if (!accounts.length) {
      details.push({ action: 'sheet_skipped', sheetName, rowCount: rows.length, reason: 'no credential rows parsed' });
      continue;
    }

    for (const account of accounts) {
      const projectIds = resolveProjectIds(account.projectHint, projects);
      const doc = {
        label: account.label,
        category: account.category,
        platform: account.platform,
        identifier: account.identifier,
        url: account.url,
        loginEmail: account.loginEmail,
        secret: account.secret || undefined,
        projectIds,
        notes: [account.notes, `Imported from sheet tab: ${account.sheetName}`]
          .filter(Boolean)
          .join('\n'),
        status: account.status,
        createdBy: user._id,
        updatedBy: user._id,
        tenantId: user.tenantId,
      };

      if (!dryRun) {
        await OrgAccount.create(doc);
      }
      created += 1;
      details.push({ action: dryRun ? 'would_create' : 'created', label: doc.label, sheetName });
    }

    details.push({
      action: 'sheet_summary',
      sheetName,
      rowCount: rows.length,
      parsed: accounts.length,
    });
  }

  return {
    mode,
    spreadsheetId: SPREADSHEET_ID,
    deleted,
    created,
    skipped: 0,
    sheets: sheetData.map((s) => ({ name: s.sheetName, rows: s.rows.length, accounts: s.accounts.length })),
    details,
  };
}

module.exports = {
  SPREADSHEET_ID,
  importOrgAccountsFromSheet,
  parseRowsFromSheet,
  parseCredentialBlock,
  buildAccountFromEntry,
};
