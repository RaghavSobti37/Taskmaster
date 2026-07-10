const axios = require('axios');

const ALLOWED_HOST_SUFFIXES = ['utfs.io', 'ufs.sh', 'uploadthing.com', 'amazonaws.com'];

function isAllowedFinanceFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return false;
  try {
    const { hostname, protocol } = new URL(fileUrl);
    if (protocol !== 'https:') return false;
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

async function downloadFinanceFile(fileUrl, maxBytes) {
  if (!isAllowedFinanceFileUrl(fileUrl)) {
    const err = new Error('File URL not allowed');
    err.statusCode = 400;
    throw err;
  }

  const response = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
  });

  return Buffer.from(response.data);
}

function guessContentType(fileName, explicitType) {
  if (explicitType && explicitType !== 'application/octet-stream') return explicitType;
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return explicitType || 'application/octet-stream';
}

function sendInlineFile(res, buffer, { contentType, fileName }) {
  const type = guessContentType(fileName, contentType);
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName || 'document')}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.removeHeader('X-Frame-Options');
  res.send(buffer);
}

module.exports = {
  isAllowedFinanceFileUrl,
  downloadFinanceFile,
  sendInlineFile,
};
