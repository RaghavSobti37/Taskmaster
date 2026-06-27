const { parseOfferingTitle, parseExlyMoney } = require('./exlyUtils');

const PRODUCT_ALIASES = [
  { re: /core\s*tribe/i, short: 'Core Tribe' },
  { re: /artist\s*path/i, short: 'Artist Path' },
  { re: /heart\s*of\s*music|heART of Music/i, short: 'heART of Music' },
  { re: /unfold\s*yourself/i, short: 'Unfold Yourself' },
];

function formatInrLabel(amount) {
  const n = Math.round(Number(amount) || 0);
  if (n <= 0) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function shortMentorName(mentor = '') {
  const m = String(mentor || '').trim();
  if (!m || m === 'TSC Faculty') return '';
  return m.split(/\s+/)[0] || m;
}

function parsePriceFromText(text = '') {
  const m = String(text).match(/₹\s*([\d,]+(?:\.\d+)?)|(?:^|\s)rs\.?\s*([\d,]+)/i);
  if (!m) return 0;
  return parseExlyMoney(m[1] || m[2]);
}

/** Short program name — one course, many Exly offering titles / price tiers. */
function shortCourseName(raw = '') {
  let t = String(raw || '').trim();
  if (!t) return 'TSC Program';

  const parsed = parseOfferingTitle(t);
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

function coursePriceFromLead(lead) {
  const md = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : {};
  const fromMeta = Number(md.dealValue ?? md.dealAmount ?? md.convertedValue);
  if (Number.isFinite(fromMeta) && fromMeta > 0) {
    return { priceInr: fromMeta, priceLabel: formatInrLabel(fromMeta) };
  }

  const titleSrc = lead.exlyOfferingTitle || lead.source || '';
  const fromTitle = parsePriceFromText(titleSrc);
  if (fromTitle > 0) {
    return { priceInr: fromTitle, priceLabel: formatInrLabel(fromTitle) };
  }

  const plan = String(lead.planOption || '').trim();
  if (plan) return { priceInr: 0, priceLabel: plan };

  return { priceInr: 0, priceLabel: '—' };
}

function mapLeadToCourseEnrollment(lead, sessionMentor = '') {
  const shortName = shortCourseName(lead.exlyOfferingTitle || lead.source || '');
  const { priceInr, priceLabel } = coursePriceFromLead(lead);
  return {
    name: lead.name || '',
    shortName,
    priceLabel,
    priceInr,
    plan: lead.planOption || '',
    mentor: shortMentorName(sessionMentor),
  };
}

function aggregateCourseEnrollments(students) {
  const counts = new Map();
  for (const s of students) {
    const key = `${s.shortName}|${s.priceLabel}`;
    const cur = counts.get(key) || {
      shortName: s.shortName,
      priceLabel: s.priceLabel,
      priceInr: s.priceInr,
      count: 0,
    };
    cur.count += 1;
    counts.set(key, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.priceInr - a.priceInr);
}

module.exports = {
  shortCourseName,
  shortMentorName,
  coursePriceFromLead,
  mapLeadToCourseEnrollment,
  aggregateCourseEnrollments,
  formatInrLabel,
};
