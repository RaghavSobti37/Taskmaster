const Team = require('../models/Team');

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;
    const team = await Team.create({ 
      name, 
      description,
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
