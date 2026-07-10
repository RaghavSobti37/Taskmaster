/** Artist CRM CSV column mapping targets (sales/academy pipeline excluded). */

const ARTIST_CRM_IMPORT_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City / Location', required: false },
  { key: 'primaryRole', label: 'Role / Designation', required: false },
  { key: 'remarks', label: 'Remarks / Notes', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'tags', label: 'Tags (comma-separated)', required: false },
];

const HEADER_ALIASES = {
  name: ['name', 'full name', 'contact name', 'event name', 'college name', 'organization', 'venues', 'publication name'],
  phone: ['phone', 'mobile', 'contact phone', 'contact', 'contact number', 'whatsapp', 'contact no'],
  email: ['email', 'email id', 'email address', 'contact email'],
  city: ['city', 'location', 'city / region', 'location (city / district)'],
  primaryRole: ['role', 'designation', 'primary role', 'contact person / role'],
  remarks: ['remarks', 'notes', 'comments'],
  source: ['source', 'category'],
  tags: ['tags', 'tag'],
};

function normalizeHeader(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function suggestArtistCrmMapping(headers = []) {
  const mapping = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  for (const field of ARTIST_CRM_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key] || [field.key];
    const match = normalizedHeaders.find(({ norm }) =>
      aliases.some((alias) => norm === alias || norm.includes(alias)));
    if (match) mapping[field.key] = match.raw;
  }

  return mapping;
}

function validateArtistCrmMapping(mapping = {}) {
  if (!mapping.name) {
    return 'Name column mapping is required.';
  }
  if (!mapping.phone && !mapping.email) {
    return 'Map at least Phone or Email.';
  }
  return null;
}

module.exports = {
  ARTIST_CRM_IMPORT_FIELDS,
  HEADER_ALIASES,
  suggestArtistCrmMapping,
  validateArtistCrmMapping,
};
