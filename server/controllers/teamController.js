const Team = require('../models/Team');

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

const ensureDefaultTeams = async () => {
  for (const t of DEFAULT_TEAMS) {
    const exists = await Team.findOne({ name: t.name });
    if (!exists) await Team.create({ name: t.name, color: t.color });
  }
};

exports.getTeams = async (req, res) => {
  try {
    await ensureDefaultTeams();
    const teams = await Team.find().sort({ name: 1 });
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
      createdBy: req.user._id
    });
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team decommissioned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
