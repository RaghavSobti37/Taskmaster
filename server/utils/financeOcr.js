const axios = require('axios');
const FinanceDocument = require('../models/FinanceDocument');
const logger = require('./logger');
const {
  getOcrMaxBytes,
  shouldRunImageOcr,
  shouldRunOcr,
} = require('./financeOcrLimits');

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

    const existing = await FinanceDocument.findById(docId).select('metadata').lean();
    const prev = existing?.metadata || {};

    await FinanceDocument.findByIdAndUpdate(docId, {
      extractedText: parsed.extractedText || '',
      ...(parsed.metadata?.detectedCategory && parsed.metadata.detectedCategory !== 'other'
        ? { category: parsed.metadata.detectedCategory }
        : {}),
      metadata: {
        amount: parsed.metadata?.amount > 0 ? parsed.metadata.amount : (Number(prev.amount) || 0),
        currency: parsed.metadata?.currency || prev.currency || 'INR',
        vendor: parsed.metadata?.vendor || prev.vendor || '',
        date: parsed.metadata?.date || prev.date || null,
        tax: parsed.metadata?.tax > 0 ? parsed.metadata.tax : (Number(prev.tax) || 0),
        detectedCategory: parsed.metadata?.detectedCategory || prev.detectedCategory || 'other',
        ...(prev.baseCurrency ? { baseCurrency: prev.baseCurrency } : {}),
        ...(prev.conversionRate != null ? { conversionRate: prev.conversionRate } : {}),
        ...(prev.conversionRateCapturedAt ? { conversionRateCapturedAt: prev.conversionRateCapturedAt } : {}),
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
