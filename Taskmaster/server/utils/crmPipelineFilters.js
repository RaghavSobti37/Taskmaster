const { escapeRegExp } = require('./sanitizer');

/** Same definition as statsWorker warmLeads / activeReach facet — meaningful connect YES. */
function warmPipelineQuery(extra = {}) {
  return {
    ...extra,
    meaningfulConnect: 'YES',
  };
}

function isWarmPipelineRequest(query = {}) {
  const v = query.warmPipeline;
  return v === true || v === 'true' || v === '1';
}

/** Case-insensitive exact match for a single leadStatus filter value. */
function leadStatusFilterValue(status) {
  if (!status || status === 'all') return null;
  return { $regex: new RegExp(`^${escapeRegExp(String(status).trim())}$`, 'i') };
}

const LEAD_STATUS_CANONICAL = {
  new: 'New',
  fresh: 'Fresh',
  cold: 'Cold',
  warm: 'Warm',
  hot: 'Hot',
  converted: 'Converted',
  interested: 'Interested',
  'not interested': 'Not Interested',
  followup: 'Followup',
  contacted: 'Contacted',
  connected: 'Connected',
  busy: 'Busy',
  dnp: 'DNP',
  lost: 'Lost',
  qualified: 'Qualified',
  proposal: 'Proposal',
  'in progress': 'In Progress',
  'already purchased': 'Already Purchased',
  'token received': 'Token Received',
};

function canonicalLeadStatus(value) {
  if (value == null || String(value).trim() === '') return value;
  const trimmed = String(value).trim();
  const key = trimmed.toLowerCase();
  return LEAD_STATUS_CANONICAL[key] || trimmed;
}

/** Dedupe lead status options case-insensitively; prefer canonical casing. */
function mergeLeadStatusOptions(distinctValues = [], configValues = []) {
  const merged = new Map();
  for (const raw of [...distinctValues, ...configValues]) {
    if (!raw) continue;
    const canonical = canonicalLeadStatus(raw);
    const key = canonical.toLowerCase();
    if (!merged.has(key)) merged.set(key, canonical);
  }
  return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  warmPipelineQuery,
  isWarmPipelineRequest,
  leadStatusFilterValue,
  canonicalLeadStatus,
  mergeLeadStatusOptions,
  LEAD_STATUS_CANONICAL,
};
