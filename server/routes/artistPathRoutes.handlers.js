const PersonHubView = require('../models/PersonHubView');
const Person = require('../models/Person');
const PersonIdentifier = require('../models/PersonIdentifier');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const { syncFromSheet } = require('../services/artistPathImportService');

exports.listPeople = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { inArtistPath: true };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: re }, { email: re }, { phone: re }];
    }

    const [total, data] = await Promise.all([
      PersonHubView.countDocuments(query).setOptions({ bypassTenant: true }),
      PersonHubView.find(query)
        .setOptions({ bypassTenant: true })
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({ data, total, page, pages: Math.ceil(total / limit) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const [person, hub, identifiers, responses] = await Promise.all([
      Person.findById(personId).lean(),
      PersonHubView.findOne({ personId }).setOptions({ bypassTenant: true }).lean(),
      PersonIdentifier.find({ personId }).lean(),
      ArtistPathResponse.find({ personId }).sort({ submittedAt: -1 }).lean(),
    ]);
    if (!person && !hub) return res.status(404).json({ error: 'Person not found' });

    res.json({
      person,
      hub,
      identifiers,
      responses,
      email: identifiers.find((i) => i.type === 'email')?.valueNormalized,
      phone: identifiers.find((i) => i.type === 'phone')?.valueNormalized,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sync = async (req, res) => {
  try {
    const result = await syncFromSheet({ userId: req.user._id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
