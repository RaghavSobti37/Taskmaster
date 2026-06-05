const UserNote = require('../models/UserNote');
const Project = require('../models/Project');

const notePopulate = [
  { path: 'projectId', select: 'name workspace members' },
  { path: 'calendarEventId', select: 'title date eventType projectId workspace' },
  { path: 'userId', select: 'name email avatar' },
];

async function userProjectIds(userId) {
  const projects = await Project.find({ members: userId }).select('_id').lean();
  return projects.map((p) => p._id);
}

function canAccessNote(note, userId, memberProjectIds) {
  if (!note) return false;
  if (String(note.userId?._id || note.userId) === String(userId)) return true;
  if (!note.shareWithTeam) return false;
  const pid = note.projectId?._id || note.projectId;
  if (!pid) return false;
  return memberProjectIds.some((id) => String(id) === String(pid));
}

exports.getNotes = async (req, res) => {
  try {
    const memberProjectIds = await userProjectIds(req.user._id);
    const notes = await UserNote.find({
      $or: [
        { userId: req.user._id },
        {
          shareWithTeam: true,
          visibility: { $in: ['project', 'event'] },
          projectId: { $in: memberProjectIds },
        },
      ],
    })
      .populate(notePopulate)
      .sort('-updatedAt');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

exports.getNote = async (req, res) => {
  try {
    const memberProjectIds = await userProjectIds(req.user._id);
    const note = await UserNote.findById(req.params.id).populate(notePopulate);
    if (!canAccessNote(note, req.user._id, memberProjectIds)) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
};

exports.createNote = async (req, res) => {
  try {
    const {
      title,
      content,
      color,
      projectId,
      calendarEventId,
      workspace,
      format,
      visibility,
      shareWithTeam,
    } = req.body;

    const note = await UserNote.create({
      userId: req.user._id,
      projectId: projectId || null,
      calendarEventId: calendarEventId || null,
      workspace: workspace || '',
      title: title || 'Untitled',
      content: content || '',
      format: format === 'plain' ? 'plain' : 'html',
      color: color || '#3b82f6',
      visibility: ['private', 'project', 'event'].includes(visibility) ? visibility : 'private',
      shareWithTeam: Boolean(shareWithTeam),
    });
    const populated = await UserNote.findById(note._id).populate(notePopulate);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const existing = await UserNote.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    const allowed = {};
    if (req.body.title !== undefined) allowed.title = req.body.title;
    if (req.body.content !== undefined) allowed.content = req.body.content;
    if (req.body.color !== undefined) allowed.color = req.body.color;
    if (req.body.format !== undefined) allowed.format = req.body.format === 'plain' ? 'plain' : 'html';
    if (req.body.projectId !== undefined) allowed.projectId = req.body.projectId || null;
    if (req.body.calendarEventId !== undefined) allowed.calendarEventId = req.body.calendarEventId || null;
    if (req.body.workspace !== undefined) allowed.workspace = req.body.workspace || '';
    if (req.body.visibility !== undefined) {
      allowed.visibility = ['private', 'project', 'event'].includes(req.body.visibility)
        ? req.body.visibility
        : 'private';
    }
    if (req.body.shareWithTeam !== undefined) allowed.shareWithTeam = Boolean(req.body.shareWithTeam);

    const note = await UserNote.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: allowed },
      { new: true }
    ).populate(notePopulate);

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
