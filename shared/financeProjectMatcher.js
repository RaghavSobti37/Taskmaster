/**
 * Match finance documents to projects by title, filename, vendor, and OCR text.
 * Low-confidence matches fall back to a General bucket project.
 */

const GENERAL_NAME_CANDIDATES = ['GENERAL', 'GENERAL ADMINISTRATION'];

const MATCH_THRESHOLD = 30;

const DEFAULT_PROJECT_ALIASES = {
  havells: 'HAVELLS MYOUSIC',
  myousic: 'HAVELLS MYOUSIC',
  havelis: 'HAVELLS MYOUSIC',
  academy: 'TSC ACADEMY',
  yugm: 'YUGM',
  harshad: 'HARSHAD DUHITA',
  duhita: 'HARSHAD DUHITA',
  dattadham: 'DATTADHAM',
  himalayan: 'HIMALAYAN HARMONIES',
  harmonies: 'HIMALAYAN HARMONIES',
  luca: 'LUCA',
  sandesh: 'SANDESH',
  prasad: 'PRASAD',
  tech: 'TECH',
};

const loadAliasMap = () => {
  const map = { ...DEFAULT_PROJECT_ALIASES };
  const raw = process.env.FINANCE_PROJECT_ALIASES_JSON || '';
  if (!raw.trim()) return map;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([key, value]) => {
        map[normalizeKey(key)] = String(value || '').trim().toUpperCase();
      });
    }
  } catch {
    // ponytail: ignore bad env JSON
  }
  return map;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const tokenize = (value) => normalizeKey(value)
  .split(/[\s/&\-_]+/)
  .filter((t) => t.length >= 2);

const buildProjectMatchers = (projects = []) => projects.map((project) => {
  const name = project.name || '';
  const key = normalizeKey(name);
  return {
    id: project._id?.toString?.() || String(project._id),
    name,
    key,
    tokens: tokenize(name),
    regex: key ? new RegExp(escapeRegex(key), 'i') : null,
  };
});

const buildDocSearchText = (doc, folderName = '') => [
  doc.title,
  doc.fileName,
  doc.description,
  doc.metadata?.vendor,
  doc.extractedText,
  folderName,
].filter(Boolean).join(' ');

const scoreProjectMatch = (text, matcher) => {
  if (!matcher?.key) return 0;
  const hay = normalizeKey(text);
  if (!hay) return 0;

  let score = 0;
  if (hay.includes(matcher.key)) score += 100;
  if (matcher.regex?.test(text)) score += 80;

  matcher.tokens.forEach((token) => {
    if (token.length >= 3 && hay.includes(token)) score += 15;
    if (token.length >= 4 && new RegExp(`\\b${escapeRegex(token)}\\b`, 'i').test(text)) score += 10;
  });

  const aliases = loadAliasMap();
  Object.entries(aliases).forEach(([aliasKey, projectName]) => {
    if (projectName !== matcher.name) return;
    if (hay.includes(aliasKey)) score += 90;
  });

  return score;
};

const isGeneralProjectName = (name) => {
  const key = normalizeKey(name);
  return GENERAL_NAME_CANDIDATES.some((candidate) => normalizeKey(candidate) === key);
};

const resolveGeneralProject = (projects = []) => {
  const general = projects.find((p) => isGeneralProjectName(p.name));
  if (general) {
    return {
      id: general._id?.toString?.() || String(general._id),
      name: general.name,
    };
  }
  return { id: null, name: 'GENERAL' };
};

/**
 * @returns {{ projectId: string|null, projectName: string, score: number, confidence: 'matched'|'general'|'keep' }}
 */
const matchFinanceDocToProject = (doc, projects, options = {}) => {
  const {
    generalProjectId = null,
    folderName = '',
    keepExistingMinScore = 25,
  } = options;

  const matchers = buildProjectMatchers(projects);
  const general = resolveGeneralProject(projects);
  const fallbackId = generalProjectId || general.id;
  const text = buildDocSearchText(doc, folderName);

  const existingId = doc.project?.toString?.() || doc.project;
  if (existingId) {
    const existingMatcher = matchers.find((m) => m.id === existingId);
    const existingScore = existingMatcher ? scoreProjectMatch(text, existingMatcher) : 0;

    const titleText = [doc.title, doc.fileName].filter(Boolean).join(' ');
    let titleBest = null;
    let titleBestScore = 0;
    matchers.forEach((matcher) => {
      if (fallbackId && matcher.id === fallbackId) return;
      const score = scoreProjectMatch(titleText, matcher);
      if (score > titleBestScore) {
        titleBestScore = score;
        titleBest = matcher;
      }
    });

    if (titleBest && titleBest.id !== existingId && titleBestScore >= 90) {
      return {
        projectId: titleBest.id,
        projectName: titleBest.name,
        score: titleBestScore,
        confidence: 'matched',
      };
    }

    if (existingScore >= keepExistingMinScore) {
      return {
        projectId: existingId,
        projectName: existingMatcher?.name || '',
        score: existingScore,
        confidence: 'keep',
      };
    }
  }

  let best = null;
  let bestScore = 0;
  matchers.forEach((matcher) => {
    if (fallbackId && matcher.id === fallbackId) return;
    const score = scoreProjectMatch(text, matcher);
    if (score > bestScore) {
      bestScore = score;
      best = matcher;
    }
  });

  if (best && bestScore >= MATCH_THRESHOLD) {
    return {
      projectId: best.id,
      projectName: best.name,
      score: bestScore,
      confidence: 'matched',
    };
  }

  return {
    projectId: fallbackId,
    projectName: general.name,
    score: bestScore,
    confidence: 'general',
  };
};

const EXPENSE_HINT_CATEGORIES = new Set(['invoice', 'receipt', 'tax']);
const NON_EXPENSE_CATEGORIES = new Set(['budget', 'contract', 'proposal']);

/** Normalize category from OCR hints when still generic. */
const resolveFinanceCategory = (doc) => {
  const current = doc.category || 'other';
  if (current !== 'other') return current;

  const detected = doc.metadata?.detectedCategory;
  if (detected && detected !== 'other') return detected;

  const hay = normalizeKey(buildDocSearchText(doc));
  if (/(?:^|\s)invoice(?:\s|$)|tax\s+invoice|bill\s+to/i.test(hay)) return 'invoice';
  if (/(?:^|\s)receipt(?:\s|$)|payment\s+received/i.test(hay)) return 'receipt';
  if (/gst|tds|tax\s+return|form\s+16/i.test(hay)) return 'tax';
  if (/budget|estimate|quotation/i.test(hay)) return 'budget';
  if (/contract|agreement|mou/i.test(hay)) return 'contract';
  if (/proposal|pitch\s+deck/i.test(hay)) return 'proposal';

  if (doc.metadata?.submissionType === 'reimbursement') return 'receipt';

  return current;
};

const isTrackableSpendCategory = (category) => (
  EXPENSE_HINT_CATEGORIES.has(category)
  || category === 'other'
  || category === 'report'
);

module.exports = {
  GENERAL_NAME_CANDIDATES,
  MATCH_THRESHOLD,
  buildProjectMatchers,
  buildDocSearchText,
  scoreProjectMatch,
  isGeneralProjectName,
  resolveGeneralProject,
  matchFinanceDocToProject,
  resolveFinanceCategory,
  isTrackableSpendCategory,
  NON_EXPENSE_CATEGORIES,
};
