const path = require('path');
const fs = require('fs');
const { listSheetTemplates } = require('../../../../shared/artistCrmSheetMappings');
const { importArtistCsvFile, detectSheetTemplate } = require('../services/artistCrmImportService');
const { isAdminUser, isArtistManagerUser } = require('../../../utils/departmentPermissions');
const logger = require('../../../utils/logger');

function requireArtistCrmAccess(req, res, next) {
  if (isAdminUser(req.user) || isArtistManagerUser(req.user)) return next();
  return res.status(403).json({ error: 'Artist CRM access required' });
}

exports.getArtistTemplates = (req, res) => {
  res.json({ templates: listSheetTemplates() });
};

exports.uploadArtistCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const template = detectSheetTemplate(req.file.originalname);
    if (!template) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'Unrecognized artist CSV filename. Expected YUGM media, Harshad Duhita sheets, or Event Database.',
      });
    }

    const result = await importArtistCsvFile({
      filePath: req.file.path,
      filename: req.file.originalname,
      userId: req.user._id,
    });

    fs.unlink(req.file.path, () => {});

    res.json({ success: true, ...result });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    logger.error('artistCrmController', 'upload failed', { error: err.message });
    res.status(500).json({ error: err.message || 'Import failed' });
  }
};

exports.importArtistFromPath = async (req, res) => {
  try {
    const { filePath, filename } = req.body;
    if (!filePath || !filename) {
      return res.status(400).json({ error: 'filePath and filename required' });
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const result = await importArtistCsvFile({
      filePath: resolved,
      filename,
      userId: req.user._id,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('artistCrmController', 'import from path failed', { error: err.message });
    res.status(500).json({ error: err.message || 'Import failed' });
  }
};

exports.requireArtistCrmAccess = requireArtistCrmAccess;
