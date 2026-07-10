const {
  normalizeEmail,
  normalizePhone,
  identityKey,
  buildHavellsIdentitySet,
} = require('./havellsDataHubService');

function isHolySheetArtistOrPr(person) {
  if (person.inArtistPath || person.inArtistCrm) return true;
  const inlets = Array.isArray(person.inlets) ? person.inlets : [];
  for (const inlet of inlets) {
    if (inlet?.key === 'artist_path' || inlet?.key === 'artist_crm') return true;
    const summary = inlet?.summary || {};
    const sourceFile = String(summary.sourceFilename || summary.source || '').toLowerCase();
    const roleText = `${summary.role || ''} ${summary.category || ''} ${summary.campaign || ''}`.toLowerCase();
    const hasHolySheetSource = sourceFile.includes('holysheet') || sourceFile.includes('holy sheet');
    const artistOrPr = /\bartist\b|\bpr\b|public relation/.test(roleText);
    if (hasHolySheetSource && artistOrPr) return true;
  }
  return false;
}

function sortDbMinusHavellsRows(rows = []) {
  return [...rows].sort((a, b) => {
    const imlDelta = Number(b.imlPriority) - Number(a.imlPriority);
    if (imlDelta !== 0) return imlDelta;
    const aName = String(a.name || '').trim();
    const bName = String(b.name || '').trim();
    if (!aName && bName) return 1;
    if (aName && !bName) return -1;
    const nameCmp = aName.localeCompare(bName, 'en', { sensitivity: 'base' });
    if (nameCmp !== 0) return nameCmp;
    const emailCmp = String(a.email || '').localeCompare(String(b.email || ''), 'en', { sensitivity: 'base' });
    if (emailCmp !== 0) return emailCmp;
    return String(a.phone || '').localeCompare(String(b.phone || ''), 'en', { sensitivity: 'base' });
  });
}

function buildHavellsMatchIndex(records = []) {
  const identitySet = buildHavellsIdentitySet(records);
  const emails = new Set();
  const phones = new Set();
  for (const record of identitySet.values()) {
    if (record.email) emails.add(record.email);
    if (record.phone) phones.add(record.phone);
  }
  return { identitySet, emails, phones };
}

function isPersonInHavells(person, matchIndex) {
  const email = normalizeEmail(person.email);
  const phone = normalizePhone(person.phone);
  const key = identityKey(email, phone);
  if (key && matchIndex.identitySet.has(key)) return true;
  if (email && matchIndex.emails.has(email)) return true;
  if (phone && matchIndex.phones.has(phone)) return true;
  return false;
}

function buildDbMinusHavellsRows(people = [], havellsRecords = []) {
  const matchIndex = Array.isArray(havellsRecords)
    ? buildHavellsMatchIndex(havellsRecords)
    : { identitySet: havellsRecords, emails: new Set(), phones: new Set() };
  const outputMap = new Map();
  let excludedArtistPr = 0;
  for (const person of people) {
    if (isHolySheetArtistOrPr(person)) {
      excludedArtistPr += 1;
      continue;
    }
    const email = normalizeEmail(person.email);
    const phone = normalizePhone(person.phone);
    const key = identityKey(email, phone);
    if (!key) continue;
    if (isPersonInHavells({ email, phone }, matchIndex)) continue;
    if (!outputMap.has(key)) {
      outputMap.set(key, {
        name: String(person.name || '').trim(),
        email,
        phone,
        imlPriority: Boolean(person.imlPriority),
      });
    }
  }
  const rows = sortDbMinusHavellsRows([...outputMap.values()]).map(({ name, email, phone }) => ({
    name,
    email,
    phone,
  }));
  return {
    rows,
    excludedArtistPr,
  };
}

module.exports = {
  isHolySheetArtistOrPr,
  buildDbMinusHavellsRows,
  sortDbMinusHavellsRows,
  buildHavellsMatchIndex,
  isPersonInHavells,
};
