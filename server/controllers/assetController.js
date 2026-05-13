const Asset = require('../models/Asset');

exports.getAssets = async (req, res) => {
  try {
    const assets = await Asset.find()
      .populate('projectId', 'name')
      .populate('createdBy', 'name')
      .sort('-createdAt');
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const { projectId, name, link } = req.body;

    const asset = await Asset.create({
      projectId: projectId || null,
      name,
      link: link || '',
      createdBy: req.user._id
    });

    const populatedAsset = await Asset.findById(asset._id)
      .populate('projectId', 'name')
      .populate('createdBy', 'name');
      
    res.status(201).json(populatedAsset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Only creator or admin can edit
    if (asset.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, link, projectId } = req.body;
    if (name !== undefined) asset.name = name;
    if (link !== undefined) asset.link = link;
    if (projectId !== undefined) asset.projectId = projectId || null;

    await asset.save();

    const populatedAsset = await Asset.findById(asset._id)
      .populate('projectId', 'name')
      .populate('createdBy', 'name');

    res.json(populatedAsset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    
    // Only creator or admin can delete
    if (asset.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Asset.findByIdAndDelete(req.params.id);
    res.json({ message: 'Asset deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
