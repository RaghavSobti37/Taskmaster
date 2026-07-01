const Team = require('../models/Team');
const { getCache, setCache, deleteCache } = require('../services/cacheService');

const TEAMS_CACHE_KEY = 'teams:list:v1';
const TEAMS_CACHE_TTL_SECONDS = 300;

const DEFAULT_TEAMS = [
  { name: 'EDITING', color: '#ef4444' },
  { name: 'SHOOT', color: '#f97316' },
  { name: 'TECH', color: '#22c55e' },
  { name: 'PR', color: '#3b82f6' },
  { name: 'MARKETING', color: '#ec4899' },
  { name: 'SALES', color: '#10b981' },
  { name: 'DESIGN', color: '#8b5cf6' },
  { name: 'SOCIAL MEDIA', color: '#06b6d4' },
  { name: 'OPERATIONS', color: '#64748b' },
];

let defaultsEnsured = false;

const ensureDefaultTeams = async () => {
  if (defaultsEnsured) return;

  const names = DEFAULT_TEAMS.map((t) => t.name);
  const existing = await Team.find({ name: { $in: names } }).select('name').lean();
  const existingNames = new Set(existing.map((t) => t.name));
  const missing = DEFAULT_TEAMS.filter((t) => !existingNames.has(t.name));

  if (missing.length) {
    await Team.insertMany(
      missing.map((t) => ({ name: t.name, color: t.color })),
      { ordered: false },
    ).catch(() => {});
  }

  defaultsEnsured = true;
};

const invalidateTeamsCache = () => deleteCache(TEAMS_CACHE_KEY);

exports.getTeams = async (req, res) => {
  try {
    const cached = await getCache(TEAMS_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    await ensureDefaultTeams();
    const teams = await Team.find().sort({ name: 1 }).lean();
    await setCache(TEAMS_CACHE_KEY, teams, TEAMS_CACHE_TTL_SECONDS);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const team = await Team.create({
      name: name.toUpperCase(),
      description,
      color,
      createdBy: req.user._id,
    });
    await invalidateTeamsCache();
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    await invalidateTeamsCache();
    res.json({ message: 'Team decommissioned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
