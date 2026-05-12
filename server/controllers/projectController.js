const Project = require('../models/Project');

exports.createProject = async (req, res) => {
  try {
    const { name, description, outletId } = req.body;
    const project = await Project.create({
      name,
      description,
      outletId,
      owner: req.user._id,
      members: [req.user._id]
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email');
    
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
