const { format } = require('date-fns');
const { normalizeRowDataMap } = require('./indexedTemplateVariables');
const {
  annotateRecipient,
  filterRecipientsByStatus,
} = require('./emailValidation');

const PHONE_KEYS = [
  'phone',
  'number',
  'mobile',
  'contact',
  'tel',
  'phone number',
  'contact number',
  'mobile number',
  'whatsapp',
  'whatsapp number',
];

const NAME_KEYS = ['name', 'full name', 'fullname', 'firstname', 'first name'];

const EMAIL_KEYS = ['email', 'e-mail'];

const escapeCsvCell = (value) => `"${String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;

const pickFromRowData = (rowData, keys) => {
  const normalized = normalizeRowDataMap(rowData);
  for (const key of keys) {
    const val = normalized[key];
    if (val && String(val).trim()) return String(val).trim();
  }
  return '';
};

const resolveRecipientExportFields = (recipient, leadDoc) => {
  const rowData = recipient?.rowData;
  const name = (
    (recipient?.name || '').trim()
    || pickFromRowData(rowData, NAME_KEYS)
    || (leadDoc?.name || '').trim()
  );
  const email = (
    (recipient?.email || '').trim()
    || pickFromRowData(rowData, EMAIL_KEYS)
    || (leadDoc?.email || '').trim()
  );
  const number = pickFromRowData(rowData, PHONE_KEYS) || (leadDoc?.phone || '').trim();
  return { name, number, email };
};

const filterCampaignRecipients = (campaignRecipients = [], { statusFilter = 'all', hideInvalid = false } = {}) => {
  let recipients = (campaignRecipients || []).map((r) => annotateRecipient(
    typeof r.toObject === 'function' ? r.toObject() : r
  ));

  const invalidCount = recipients.filter((r) => r.invalidEmail).length;

  if (hideInvalid) {
    recipients = recipients.filter((r) => !r.invalidEmail);
  }

  recipients = filterRecipientsByStatus(recipients, String(statusFilter || 'all').toLowerCase());

  return { recipients, invalidCount };
};

const recipientsToCsv = (rows) => {
  const header = ['name', 'number', 'email'].map(escapeCsvCell).join(',');
  const body = rows.map((row) => [
    escapeCsvCell(row.name),
    escapeCsvCell(row.number),
    escapeCsvCell(row.email),
  ].join(',')).join('\n');
  return body ? `${header}\n${body}` : header;
};

const sanitizeExportFilenamePart = (value, fallback = 'campaign') => {
  const cleaned = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
};

const buildRecipientExportFilename = (campaignTitle, statusFilter, date = new Date()) => {
  const namePart = sanitizeExportFilenamePart(campaignTitle, 'campaign');
  const filterPart = sanitizeExportFilenamePart(statusFilter, 'all');
  const datePart = format(date, 'yyyy-MM-dd');
  return `${namePart}-${filterPart}-${datePart}.csv`;
};

module.exports = {
  PHONE_KEYS,
  resolveRecipientExportFields,
  filterCampaignRecipients,
  recipientsToCsv,
  sanitizeExportFilenamePart,
  buildRecipientExportFilename,
};
