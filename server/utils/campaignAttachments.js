const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const UPLOAD_DIR = path.join(__dirname, '../uploads/campaign-attachments');

const loadCampaignAttachments = async (campaignOrList) => {
  const attachments = Array.isArray(campaignOrList)
    ? campaignOrList
    : (campaignOrList?.attachments || []);
  if (!attachments.length) return [];

  const fsPromises = fs.promises;
  const rows = await Promise.all(attachments.map(async (att) => {
    const storageKey = att.storageKey;
    if (!storageKey) {
      logger.warn('campaignAttachments', 'Missing storageKey', { filename: att.filename });
      return null;
    }
    const filePath = path.join(UPLOAD_DIR, storageKey);
    try {
      await fsPromises.access(filePath);
    } catch {
      logger.warn('campaignAttachments', 'Attachment file not found on disk', { storageKey, filePath });
      return null;
    }
    const buffer = await fsPromises.readFile(filePath);
    return {
      filename: att.filename || storageKey,
      contentType: att.contentType || 'application/octet-stream',
      buffer,
      contentBase64: buffer.toString('base64'),
    };
  }));
  return rows.filter(Boolean);
};

const formatResendAttachments = (rows) => rows.map((a) => ({
  filename: a.filename,
  content: a.contentBase64,
}));

const formatNodemailerAttachments = (rows) => rows.map((a) => ({
  filename: a.filename,
  content: a.buffer,
  contentType: a.contentType,
}));

module.exports = {
  UPLOAD_DIR,
  loadCampaignAttachments,
  formatResendAttachments,
  formatNodemailerAttachments,
};
