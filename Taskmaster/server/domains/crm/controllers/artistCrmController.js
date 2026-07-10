const path = require('path');
const fs = require('fs');
const { listSheetTemplates } = require('../../../../shared/artistCrmSheetMappings');
const { ARTIST_CRM_IMPORT_FIELDS } = require('../../../../shared/artistCrmImportFields');
const {
  previewArtistCsvFile,
  importArtistCsvWithOptions,
} = require('../services/artistCrmMappedImportService');
const { listArtistCallAssignees } = require('../../../utils/artistCallAssignees');
const { listImportSheetFilters } = require('../../../../shared/artistCrmSheetAssignees');
const { isAdminUser, isArtistManagerUser } = require('../../../utils/departmentPermissions');
const logger = require('../../../utils/logger');

function requireArtistCrmAccess(req, res, next) {
  if (isAdminUser(req.user) || isArtistManagerUser(req.user)) return next();
  return res.status(403).json({ error: 'Artist CRM access required' });
}

function parseMappingBody(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

exports.getArtistTemplates = (req, res) => {
  res.json({
    templates: listSheetTemplates(),
    fields: ARTIST_CRM_IMPORT_FIELDS,
  });
};

exports.getArtistCallAssignees = async (req, res) => {
  try {
    const assignees = await listArtistCallAssignees();
    res.json(assignees);
  } catch (err) {
    logger.error('artistCrmController', 'assignees failed', { error: err.message });
    res.status(500).json({ error: 'Failed to load assignees' });
  }
};

exports.getArtistImportSheets = (req, res) => {
  res.json({ sheets: listImportSheetFilters() });
};

exports.previewArtistCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const sheetName = req.body?.sheetName || req.file.originalname.replace(/\.csv$/i, '');
    const preview = await previewArtistCsvFile(req.file.path, req.file.originalname, { sheetName });
    fs.unlink(req.file.path, () => {});
    res.json(preview);
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    logger.error('artistCrmController', 'preview failed', { error: err.message });
    res.status(500).json({ error: err.message || 'Preview failed' });
  }
};

exports.uploadArtistCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mapping = parseMappingBody(req.body?.mapping);
    const assignedRepId = req.body?.assignedRepId;
    const sheetName = req.body?.sheetName || req.file.originalname.replace(/\.csv$/i, '');
    const useSheetAssignee = req.body?.useSheetAssignee !== 'false';

    const result = await importArtistCsvWithOptions({
      filePath: req.file.path,
      filename: req.file.originalname,
      userId: req.user._id,
      mapping,
      assignedRepId,
      sheetName: useSheetAssignee ? sheetName : null,
    });

    fs.unlink(req.file.path, () => {});
    res.json({ success: true, ...result });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    logger.error('artistCrmController', 'upload failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Import failed' });
  }
};

exports.importArtistFromPath = async (req, res) => {
  try {
    const { filePath, filename, mapping, assignedRepId } = req.body;
    if (!filePath || !filename) {
      return res.status(400).json({ error: 'filePath and filename required' });
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const result = await importArtistCsvWithOptions({
      filePath: resolved,
      filename,
      userId: req.user._id,
      mapping: parseMappingBody(mapping),
      assignedRepId,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('artistCrmController', 'import from path failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Import failed' });
  }
};

exports.requireArtistCrmAccess = requireArtistCrmAccess;
