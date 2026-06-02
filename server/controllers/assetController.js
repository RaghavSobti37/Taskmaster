const Asset = require('../models/Asset');
const { isAdminUser } = require('../utils/departmentPermissions');
const { createNotification } = require('../services/notificationDispatcher');
const { buildMentionNotifications } = require('../utils/mentionNotifications');
const { queueGamificationEvent } = require('../services/backgroundQueue');

const dispatchMentionNotifications = (payloads = []) => {
  for (const payload of payloads) {
    createNotification(payload).catch(() => {});
  }
};

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
      .populate('createdBy', 'name avatar')
      .sort('-createdAt');
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const { projectId, projectIds, name, link, type, notes } = req.body;
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
      notes: notes?.trim() || '',
      createdBy: req.user._id
    });

    const populatedAsset = await Asset.findById(asset._id)
      .populate('projectIds', 'name')
      .populate('createdBy', 'name avatar');

    const mentionPayloads = await buildMentionNotifications({
      text: asset.notes,
      previousText: '',
      actor: req.user,
      asset,
    });
    dispatchMentionNotifications(mentionPayloads);

    queueGamificationEvent('ASSET_UPLOADED', {
      userId: req.user._id,
      asset: { _id: asset._id },
    });

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

    const previousNotes = asset.notes;

    const { name, link, projectId, projectIds, type, notes } = req.body;
    if (name !== undefined) asset.name = name;
    if (link !== undefined) asset.link = link;
    if (type !== undefined) asset.type = type;
    if (notes !== undefined) asset.notes = notes.trim();
    if (projectIds !== undefined) {
      asset.projectIds = Array.isArray(projectIds) ? projectIds.filter(Boolean) : [];
    } else if (projectId !== undefined) {
      asset.projectIds = projectId ? [projectId] : [];
    }

    await asset.save();

    const populatedAsset = await Asset.findById(asset._id)
      .populate('projectIds', 'name')
      .populate('createdBy', 'name avatar');

    if (notes !== undefined && String(asset.notes || '') !== String(previousNotes || '')) {
      const mentionPayloads = await buildMentionNotifications({
        text: asset.notes,
        previousText: previousNotes,
        actor: req.user,
        asset,
      });
      dispatchMentionNotifications(mentionPayloads);
    }

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
