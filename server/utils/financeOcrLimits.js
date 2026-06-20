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

module.exports = {
  getOcrMaxBytes,
  shouldRunImageOcr,
  shouldRunOcr,
};
