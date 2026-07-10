const Project = require('../models/Project');
const { formatProjectName } = require('./formatProjectName');

const BYPASS = { bypassTenant: true };

const DEFAULT_ALIASES = {
  yugm: 'YUGM',
  'harshad & duhita': 'HARSHAD DUHITA',
  'harshad and duhita': 'HARSHAD DUHITA',
};

function normalizeArtistKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function loadAliasMap() {
  const map = { ...DEFAULT_ALIASES };
  const raw = process.env.ARTIST_ENQUIRY_PROJECT_MAP;
  if (!raw) return map;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [key, projectName] of Object.entries(parsed)) {
        map[normalizeArtistKey(key)] = formatProjectName(projectName);
      }
    }
  } catch {
    console.warn('[artist-enquiry] Invalid ARTIST_ENQUIRY_PROJECT_MAP JSON, using defaults');
  }
  return map;
}

function resolveProjectNameFromArtist(artistInput) {
  const key = normalizeArtistKey(artistInput);
  if (!key) return null;
  const aliases = loadAliasMap();
  if (aliases[key]) return aliases[key];
  return formatProjectName(artistInput);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** DB may store "Yugm" while aliases resolve to "YUGM" — match case-insensitively. */
async function findProjectByName(projectName) {
  if (!projectName) return null;

  const exact = await Project.findOne({ name: projectName }).setOptions(BYPASS).lean();
  if (exact) return exact;

  const pattern = new RegExp(`^${escapeRegex(projectName)}$`, 'i');
  return Project.findOne({ name: pattern }).setOptions(BYPASS).lean();
}

/** Match artist label to project.name via normalized keys (yugm ↔ Yugm). */
async function findProjectByNormalizedArtistKey(artistKey) {
  if (!artistKey) return null;

  const candidates = await Project.find({
    workspace: 'TSC ARTISTS',
    status: 'active',
  })
    .setOptions(BYPASS)
    .lean();

  const aliasTarget = loadAliasMap()[artistKey];
  const aliasKey = aliasTarget ? normalizeArtistKey(aliasTarget) : null;

  for (const project of candidates) {
    const projectKey = normalizeArtistKey(project.name);
    if (projectKey === artistKey) return project;
    if (aliasKey && projectKey === aliasKey) return project;
    if (aliasTarget && project.name && new RegExp(`^${escapeRegex(aliasTarget)}$`, 'i').test(project.name)) {
      return project;
    }
  }

  return null;
}

async function findProjectByArtist(artistInput) {
  const artistKey = normalizeArtistKey(artistInput);
  if (!artistKey) return null;

  const projectName = resolveProjectNameFromArtist(artistInput);

  let project = await findProjectByName(projectName);
  if (project) return project;

  project = await findProjectByNormalizedArtistKey(artistKey);
  if (project) return project;

  const fallbackName = process.env.ARTIST_ENQUIRY_FALLBACK_PROJECT_NAME
    ? formatProjectName(process.env.ARTIST_ENQUIRY_FALLBACK_PROJECT_NAME)
    : null;

  if (fallbackName) {
    project = await findProjectByName(fallbackName);
    if (project) return project;
  }

  project = await Project.findOne({ workspace: 'TSC ARTISTS', status: 'active' })
    .sort({ createdAt: 1 })
    .setOptions(BYPASS)
    .lean();

  if (project) {
    console.warn(
      '[artist-enquiry] No project match for artist "%s"; using first TSC ARTISTS project "%s"',
      artistInput,
      project.name
    );
  }

  return project;
}

module.exports = {
  normalizeArtistKey,
  resolveProjectNameFromArtist,
  findProjectByArtist,
};
