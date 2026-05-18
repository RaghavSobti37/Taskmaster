const express = require('express');
const router = express.Router();
const OfficeAsset = require('../models/OfficeAsset');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const assets = await OfficeAsset.find().populate('updatedBy', 'name email avatar').sort('-createdAt');
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching office assets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const asset = new OfficeAsset({
      ...req.body,
      updatedBy: req.user._id,
      history: [{
        action: 'Created',
        user: req.user.name || req.user.email,
        notes: 'Asset added to system'
      }]
    });
    const saved = await asset.save();
    const populated = await OfficeAsset.findById(saved._id).populate('updatedBy', 'name email avatar');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create asset' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const asset = await OfficeAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    
    let action = 'Updated';
    if (req.body.currentlyWith && req.body.currentlyWith !== asset.currentlyWith) {
      action = `Assigned to ${req.body.currentlyWith}`;
    } else if (req.body.status && req.body.status !== asset.status) {
      action = `Status changed to ${req.body.status}`;
    }

    const updates = {
      ...req.body,
      updatedBy: req.user._id,
    };

    const newHistory = {
      action,
      user: req.user.name || req.user.email,
      notes: req.body.updateNotes || 'Updated details'
    };

    const updated = await OfficeAsset.findByIdAndUpdate(
      req.params.id,
      { $set: updates, $push: { history: newHistory } },
      { new: true }
    ).populate('updatedBy', 'name email avatar');

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update asset' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await OfficeAsset.findByIdAndDelete(req.params.id);
    res.json({ message: 'Asset removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = router;
