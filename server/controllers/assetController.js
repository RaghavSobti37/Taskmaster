const Asset = require('../models/Asset');
const { isAdminUser } = require('../utils/departmentPermissions');

exports.getAssets = async (req, res) => {
  try {
    const { projectId } = req.query;
    const query = {};
    if (projectId) {
      if (projectId === 'null') {
        query.projectIds = { $size: 0 };
      } else {
        query.projectIds = projectId;
      }
    }
    const assets = await Asset.find(query)
      .populate('projectIds', 'name')
      .populate('createdBy', 'name')
      .sort('-createdAt');
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const { projectId, projectIds, name, link, type } = req.body;
    let finalProjectIds = [];
    if (Array.isArray(projectIds)) {
      finalProjectIds = projectIds.filter(Boolean);
    } else if (projectId) {
      finalProjectIds = [projectId];
    }

    const asset = await Asset.create({
      projectIds: finalProjectIds,
      name,
      link: link || '',
      type: type || 'other',
      createdBy: req.user._id
    });

    const populatedAsset = await Asset.findById(asset._id)
      .populate('projectIds', 'name')
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
    if (asset.createdBy.toString() !== req.user._id.toString() && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, link, projectId, projectIds, type } = req.body;
    if (name !== undefined) asset.name = name;
    if (link !== undefined) asset.link = link;
    if (type !== undefined) asset.type = type;
    if (projectIds !== undefined) {
      asset.projectIds = Array.isArray(projectIds) ? projectIds.filter(Boolean) : [];
    } else if (projectId !== undefined) {
      asset.projectIds = projectId ? [projectId] : [];
    }

    await asset.save();

    const populatedAsset = await Asset.findById(asset._id)
      .populate('projectIds', 'name')
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
    if (asset.createdBy.toString() !== req.user._id.toString() && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Asset.findByIdAndDelete(req.params.id);
    res.json({ message: 'Asset deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
