const Sheet = require('../models/Sheet');

exports.getSheets = async (req, res) => {
  try {
    const sheets = await Sheet.find({ userId: req.user._id }).sort('-createdAt');
    res.json(sheets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createSheet = async (req, res) => {
  try {
    const { title, spreadsheetId, sheetName, apiKey } = req.body;
    if (!title || !spreadsheetId || !apiKey) {
      return res.status(400).json({ error: 'Title, Spreadsheet ID/URL, and HolySheet API Key are required' });
    }

    // Clean spreadsheetId if user pasted full URL
    let cleanId = spreadsheetId.trim();
    if (cleanId.includes('/d/')) {
      const parts = cleanId.split('/d/')[1].split('/');
      cleanId = parts[0];
    }

    const sheet = await Sheet.create({
      userId: req.user._id,
      title,
      spreadsheetId: cleanId,
      sheetName: (sheetName || '').trim(),
      apiKey: apiKey.trim()
    });

    res.status(201).json(sheet);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateSheet = async (req, res) => {
  try {
    const sheet = await Sheet.findOne({ _id: req.params.id, userId: req.user._id });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

    const { title, spreadsheetId, sheetName, apiKey } = req.body;
    if (title) sheet.title = title;
    if (spreadsheetId) {
      let cleanId = spreadsheetId.trim();
      if (cleanId.includes('/d/')) {
        const parts = cleanId.split('/d/')[1].split('/');
        cleanId = parts[0];
      }
      sheet.spreadsheetId = cleanId;
    }
    if (sheetName !== undefined) sheet.sheetName = sheetName.trim();
    if (apiKey) sheet.apiKey = apiKey.trim();

    await sheet.save();
    res.json(sheet);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteSheet = async (req, res) => {
  try {
    const sheet = await Sheet.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    res.json({ message: 'Sheet deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
