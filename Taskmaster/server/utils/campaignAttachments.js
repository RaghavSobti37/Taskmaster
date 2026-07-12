const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const UPLOAD_DIR = path.join(__dirname, '../uploads/campaign-attachments');
const FETCH_TIMEOUT_MS = 15000;

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const resolveRemoteUrl = (att) => {
  if (att?.storageUrl && isHttpUrl(att.storageUrl)) return att.storageUrl.trim();
  if (att?.storageKey && isHttpUrl(att.storageKey)) return att.storageKey.trim();
  return null;
};

const fetchAttachmentBuffer = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timer);
  }
};

const readLocalAttachmentBuffer = async (storageKey) => {
  const filePath = path.join(UPLOAD_DIR, storageKey);
  const fsPromises = fs.promises;
  try {
    await fsPromises.access(filePath);
  } catch {
    logger.warn('campaignAttachments', 'Attachment file not found on disk', { storageKey, filePath });
    return null;
  }
  return fsPromises.readFile(filePath);
};

/** Load one attachment buffer from UploadThing URL or legacy local disk. */
const resolveAttachmentBuffer = async (att) => {
  const remoteUrl = resolveRemoteUrl(att);
  if (remoteUrl) {
    try {
      return await fetchAttachmentBuffer(remoteUrl);
    } catch (err) {
      logger.warn('campaignAttachments', 'Failed to fetch remote attachment', {
        url: remoteUrl,
        filename: att.filename,
        error: err.message,
      });
      return null;
    }
  }

  const storageKey = att?.storageKey;
  if (!storageKey) {
    logger.warn('campaignAttachments', 'Missing storageKey', { filename: att?.filename });
    return null;
  }
  return readLocalAttachmentBuffer(storageKey);
};

const loadCampaignAttachments = async (campaignOrList) => {
  const attachments = Array.isArray(campaignOrList)
    ? campaignOrList
    : (campaignOrList?.attachments || []);
  if (!attachments.length) return [];

  const rows = await Promise.all(attachments.map(async (att) => {
    const buffer = await resolveAttachmentBuffer(att);
    if (!buffer) return null;
    const storageKey = att.storageKey || att.filename;
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
  resolveAttachmentBuffer,
  resolveRemoteUrl,
  loadCampaignAttachments,
  formatResendAttachments,
  formatNodemailerAttachments,
};
