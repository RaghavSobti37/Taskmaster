const PinBoardNote = require('../models/PinBoardNote');

exports.getPins = async (req, res) => {
  try {
    const pins = await PinBoardNote.find()
      .sort('-updatedAt')
      .populate('createdBy', 'name avatar')
      .populate('updatedBy', 'name avatar');
    res.json(pins);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pin board' });
  }
};

exports.createPin = async (req, res) => {
  try {
    const { title, content } = req.body;
    const pin = await PinBoardNote.create({
      title: title || '',
      content: content || '',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    const populated = await PinBoardNote.findById(pin._id)
      .populate('createdBy', 'name avatar')
      .populate('updatedBy', 'name avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pin' });
  }
};

exports.updatePin = async (req, res) => {
  try {
    const pin = await PinBoardNote.findByIdAndUpdate(
      req.params.id,
      { $set: { title: req.body.title, content: req.body.content, updatedBy: req.user._id } },
      { new: true }
    )
      .populate('createdBy', 'name avatar')
      .populate('updatedBy', 'name avatar');
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    res.json(pin);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pin' });
  }
};

exports.deletePin = async (req, res) => {
  try {
    const pin = await PinBoardNote.findByIdAndDelete(req.params.id);
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete pin' });
  }
};
