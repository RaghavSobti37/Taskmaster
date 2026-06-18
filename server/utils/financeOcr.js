const axios = require('axios');
const FinanceDocument = require('../models/FinanceDocument');
const logger = require('./logger');

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function getOcrMaxBytes() {
  const configured = Number(process.env.FINANCE_OCR_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

/** Tesseract is too heavy for Render free tier (512MB). PDF text extract is lighter. */
function shouldRunImageOcr() {
  if (process.env.FINANCE_SKIP_IMAGE_OCR === '1') return false;
  if (process.env.RENDER === 'true') return false;
  return true;
}

function shouldRunOcr(fileSize) {
  const maxBytes = getOcrMaxBytes();
  if (fileSize && fileSize > maxBytes) return false;
  return true;
}

async function runFinanceDocumentOcr(docId, { fileUrl, fileType, fileName, fileSize }) {
  if (!fileUrl || !docId) return;
  if (!shouldRunOcr(fileSize)) {
    logger.debug('Finance', 'Skipping OCR — file exceeds memory-safe limit', { docId, fileSize });
    return;
  }

  const maxBytes = getOcrMaxBytes();
  let buffer;
  try {
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
    });
    buffer = Buffer.from(response.data);
  } catch (err) {
    logger.warn('Finance', 'Deferred OCR download failed', { docId, error: err.message });
    return;
  }

  if (buffer.length > maxBytes) {
    logger.debug('Finance', 'Skipping OCR — downloaded file too large', { docId, bytes: buffer.length });
    return;
  }

  try {
    const { parseDocument } = require('./documentParser');
    const mimeType = fileType || fileName?.split('.').pop() || 'application/pdf';
    const parsed = await parseDocument(buffer, mimeType, { fileSize: buffer.length });

    await FinanceDocument.findByIdAndUpdate(docId, {
      extractedText: parsed.extractedText || '',
      ...(parsed.metadata?.detectedCategory && parsed.metadata.detectedCategory !== 'other'
        ? { category: parsed.metadata.detectedCategory }
        : {}),
      metadata: {
        amount: parsed.metadata?.amount || 0,
        currency: parsed.metadata?.currency || 'INR',
        vendor: parsed.metadata?.vendor || '',
        date: parsed.metadata?.date || null,
        tax: parsed.metadata?.tax || 0,
        detectedCategory: parsed.metadata?.detectedCategory || 'other',
      },
    });
  } catch (err) {
    logger.warn('Finance', 'Deferred OCR parse failed', { docId, error: err.message });
  }
}

/** Run OCR after upload response — keeps request path off 512MB Render heap. */
function scheduleFinanceDocumentOcr(docId, fileMeta) {
  if (!docId || !fileMeta?.fileUrl) return;
  if (!shouldRunOcr(fileMeta.fileSize)) return;

  setImmediate(() => {
    runFinanceDocumentOcr(docId, fileMeta).catch((err) => {
      logger.warn('Finance', 'Deferred OCR task failed', { docId, error: err.message });
    });
  });
}

module.exports = {
  getOcrMaxBytes,
  shouldRunImageOcr,
  shouldRunOcr,
  runFinanceDocumentOcr,
  scheduleFinanceDocumentOcr,
};
