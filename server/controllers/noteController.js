const UserNote = require('../models/UserNote');

const notePopulate = { path: 'projectId', select: 'name workspace' };

exports.getNotes = async (req, res) => {
  try {
    const notes = await UserNote.find({ userId: req.user._id })
      .populate(notePopulate)
      .sort('-updatedAt');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

exports.createNote = async (req, res) => {
  try {
    const { title, content, color, projectId } = req.body;
    const note = await UserNote.create({
      userId: req.user._id,
      projectId: projectId || null,
      title: title || 'Untitled',
      content: content || '',
      color: color || '#3b82f6'
    });
    const populated = await UserNote.findById(note._id).populate(notePopulate);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const allowed = {};
    if (req.body.title !== undefined) allowed.title = req.body.title;
    if (req.body.content !== undefined) allowed.content = req.body.content;
    if (req.body.color !== undefined) allowed.color = req.body.color;
    if (req.body.projectId !== undefined) allowed.projectId = req.body.projectId || null;

    const note = await UserNote.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: allowed },
      { new: true }
    ).populate(notePopulate);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const note = await UserNote.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
};
