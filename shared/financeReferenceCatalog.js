/** TSC finance reference prefixes — workspace + project codes for document numbering. */

const WORKSPACE_CODES = {
  'tsc collabs': 'TSCCO',
  'tsc corporate': 'TSCCR',
  'tsc academy': 'TSCAC',
  'tsc artists': 'TSCAR',
  'tsc films': 'TSCFL',
  'tsc studios': 'TSCST',
  'tsc tech': 'TSCTCH',
};

/** Project name aliases → full prefix (includes workspace segment when applicable). */
const PROJECT_CODES = [
  { keys: ['havells myousic', 'havells mYOUsic', 'havells music'], code: 'TSCCO-HM' },
  { keys: ['main bhi artist', 'mba'], code: 'TSCCO-MBA' },
  { keys: ['luca course', 'luca'], code: 'TSCAC-LC' },
  { keys: ['prasad sir course', 'prasad sir'], code: 'TSCAC-PS' },
  { keys: ['sandesh sir course', 'sandesh sir'], code: 'TSCAC-SS' },
  { keys: ['harshad and duhita', 'harshad duhita', 'hnd'], code: 'TSCAR-HND' },
  { keys: ['yugm'], code: 'TSCAR-YUG' },
  { keys: ['mohit shankar', 'msr'], code: 'TSCAR-MSR' },
  { keys: ['hanuman ansh', 'hanuman'], code: 'TSCFL-HA' },
  { keys: ['jay jagannath', 'jj'], code: 'TSCFL-JJ' },
  { keys: ['mahavatar narsimha', 'narsimha', 'ns'], code: 'TSCFL-NS' },
  { keys: ['himalayan harmonies', 'hh'], code: 'TSCST-HH' },
  { keys: ['iml'], code: 'TSCST-IML' },
  { keys: ['young gunns', 'young guns', 'yg'], code: 'TSCST-YG' },
  { keys: ['tsc website', 'website'], code: 'TSCTCH-WBS' },
];

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function resolveWorkspaceCode(workspaceName) {
  const key = normalizeKey(workspaceName);
  return WORKSPACE_CODES[key] || null;
}

function resolveProjectReferencePrefix({ name, workspace } = {}) {
  const projectKey = normalizeKey(name);
  for (const entry of PROJECT_CODES) {
    if (entry.keys.some((k) => normalizeKey(k) === projectKey)) {
      return entry.code;
    }
  }
  for (const entry of PROJECT_CODES) {
    if (entry.keys.some((k) => {
      const nk = normalizeKey(k);
      return nk.length >= 5 && (projectKey.includes(nk) || nk.includes(projectKey));
    })) {
      return entry.code;
    }
  }
  return resolveWorkspaceCode(workspace) || 'GEN';
}

function formatReferenceNumber(prefix, sequence) {
  const safePrefix = String(prefix || 'GEN').toUpperCase();
  const num = Math.max(1, Number(sequence) || 1);
  return `${safePrefix}-${String(num).padStart(3, '0')}`;
}

function parseReferenceSequence(referenceNumber, prefix) {
  if (!referenceNumber || !prefix) return 0;
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(referenceNumber).trim().match(new RegExp(`^${escaped}-(\\d+)$`, 'i'));
  return match ? parseInt(match[1], 10) : 0;
}

module.exports = {
  WORKSPACE_CODES,
  PROJECT_CODES,
  normalizeKey,
  resolveWorkspaceCode,
  resolveProjectReferencePrefix,
  formatReferenceNumber,
  parseReferenceSequence,
};
