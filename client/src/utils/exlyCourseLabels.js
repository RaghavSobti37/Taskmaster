const PRODUCT_ALIASES = [
  { re: /core\s*tribe/i, short: 'Core Tribe' },
  { re: /artist\s*path/i, short: 'Artist Path' },
  { re: /heart\s*of\s*music|heART of Music/i, short: 'heART of Music' },
  { re: /unfold\s*yourself/i, short: 'Unfold Yourself' },
];

const MASTERCLASS_RE = /masterclass|master class|webinar|workshop|live session/i;

export function parseOfferingTitleParts(title = '') {
  const parts = String(title).split('|').map((p) => p.trim());
  if (parts.length >= 3) {
    return { cleanTitle: parts.slice(2).join(' | '), dateStr: parts[0], timeStr: parts[1] };
  }
  if (parts.length === 2) {
    return { cleanTitle: parts[1], dateStr: parts[0], timeStr: '' };
  }
  return { cleanTitle: title, dateStr: '', timeStr: '' };
}

export function shortMentorName(mentor = '') {
  const m = String(mentor || '').trim();
  if (!m || m === 'TSC Faculty') return '';
  return m.split(/\s+/)[0] || m;
}

export function mentorFromOfferingTitle(title = '') {
  const { cleanTitle } = parseOfferingTitleParts(title);
  const trimName = (raw) => raw.split(/\s*-\s*/)[0].trim();
  const byMatch = cleanTitle.match(/\bby\s+([A-Za-z .'-]{3,50})/i);
  if (byMatch) return shortMentorName(trimName(byMatch[1]));
  const withMatch = cleanTitle.match(/\bwith\s+([A-Za-z .'-]{3,50})/i);
  if (withMatch) return shortMentorName(trimName(withMatch[1]));
  return '';
}

export function shortCourseName(raw = '') {
  let t = String(raw || '').trim();
  if (!t) return 'TSC Program';

  const parsed = parseOfferingTitleParts(t);
  t = parsed.cleanTitle || t;

  t = t
    .replace(/\s*-\s*Live Masterclass.*/i, '')
    .replace(/\s*-\s*Exclusive Live Masterclass.*/i, '')
    .replace(/\s*-\s*TOKEN\s*$/i, '')
    .replace(/\s*\|\s*.*$/, '');

  for (const { re, short } of PRODUCT_ALIASES) {
    if (re.test(t)) return short;
  }

  t = t
    .replace(/\s+by\s+[A-Za-z .'-]+$/i, '')
    .replace(/\s+with\s+[A-Za-z .'-]+$/i, '')
    .replace(/\s*-\s*(One[- ]Time|Early Bird|EMI|Instalment|Payment Plan).*$/i, '')
    .replace(/\s*-\s*₹.*$/i, '')
    .replace(/\s*-\s*\d+\s*Mo.*$/i, '');

  const chunk = t.split(/\s*-\s*/)[0].trim();
  if (!chunk) return 'TSC Program';
  if (chunk.length > 28) return `${chunk.slice(0, 26).trim()}…`;
  return chunk;
}

export function shortMasterclassName(title = '') {
  const { cleanTitle } = parseOfferingTitleParts(title);
  const name = cleanTitle
    .replace(/\s*-\s*Live Masterclass.*/i, '')
    .replace(/\s*-\s*Exclusive Live Masterclass.*/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s+by\s+[A-Za-z .'-]+$/i, '')
    .replace(/\s+with\s+[A-Za-z .'-]+$/i, '')
    .trim();
  return name.length > 32 ? `${name.slice(0, 30).trim()}…` : name || title;
}

export function isMasterclassOfferingTitle(title = '', type = '') {
  const t = String(type || '').toLowerCase();
  if (t.includes('masterclass') || t.includes('webinar')) return true;
  return MASTERCLASS_RE.test(title) && !/course|core tribe|program|academy/i.test(title.replace(/masterclass/gi, ''));
}

/** Dense table cell: short label + mentor or price line. */
export function formatOfferingDisplay(title = '', { type = '', price = 0 } = {}) {
  const mentor = mentorFromOfferingTitle(title);
  if (isMasterclassOfferingTitle(title, type)) {
    return {
      primary: shortMasterclassName(title),
      secondary: mentor ? `w/ ${mentor}` : '',
      mentor,
      kind: 'masterclass',
    };
  }
  const primary = shortCourseName(title);
  const priceLabel = price > 0 ? `₹${Math.round(price).toLocaleString('en-IN')}` : '';
  return {
    primary,
    secondary: priceLabel,
    mentor: '',
    kind: 'course',
  };
}

export const EXLY_PAGE_LEGEND = [
  { key: 'mentor', label: 'Mentor', hint: 'Sandesh / Prasad — who hosted the live masterclass' },
  { key: 'course', label: 'Course', hint: 'Short program name (one course, many price tiers)' },
  { key: 'price', label: 'Price', hint: 'What they paid at conversion — CRM deal value or plan' },
  { key: 'regs', label: 'Regs', hint: 'Exly sign-ups for that masterclass session' },
];
