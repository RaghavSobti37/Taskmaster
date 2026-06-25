const express = require('express');
const MediaContact = require('../models/MediaContact');
const { MEDIA_SHEETS } = require('../data/mediaSheetManifest');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const router = express.Router();
const mediaListAccess = requirePageAccess('admin_data');

router.use(protect, mediaListAccess);

router.get('/', async (req, res) => {
  try {
    const { publication, niche, sourceSheet, q } = req.query;
    const filter = {};

    if (sourceSheet) filter.sourceSheet = sourceSheet;
    if (publication) filter.publication = publication;
    if (niche) filter.niche = niche;
    if (q) {
      const term = String(q).trim();
      if (term) {
        filter.$or = [
          { publication: { $regex: term, $options: 'i' } },
          { journalistName: { $regex: term, $options: 'i' } },
          { designation: { $regex: term, $options: 'i' } },
          { contactEmail: { $regex: term, $options: 'i' } },
          { contactPhone: { $regex: term, $options: 'i' } },
          { niche: { $regex: term, $options: 'i' } },
          { location: { $regex: term, $options: 'i' } },
          { notes: { $regex: term, $options: 'i' } },
        ];
      }
    }

    const contacts = await MediaContact.find(filter)
      .sort({ sourceSheet: 1, publication: 1, journalistName: 1 })
      .lean();

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media contacts' });
  }
});

router.get('/filters', async (req, res) => {
  try {
    const { sourceSheet } = req.query;
    const baseFilter = sourceSheet ? { sourceSheet } : {};

    const [publications, niches, sheetCounts] = await Promise.all([
      MediaContact.distinct('publication', baseFilter),
      MediaContact.distinct('niche', baseFilter),
      MediaContact.aggregate([
        { $group: { _id: '$sourceSheet', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const countsBySheet = Object.fromEntries(
      sheetCounts.map((row) => [row._id, row.count]),
    );

    res.json({
      sheets: MEDIA_SHEETS.map((sheet) => ({
        name: sheet.name,
        count: countsBySheet[sheet.name] || 0,
      })),
      publications: publications.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      niches: niches.filter(Boolean).sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media list filters' });
  }
});

module.exports = router;
