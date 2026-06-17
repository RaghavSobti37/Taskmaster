/**
 * Integration smoke test: finance upload via UploadThing client route (not server UTApi).
 * Run: node server/scripts/testFinanceUpload.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { genUploader } = require('uploadthing/client');
const { generateSessionToken } = require('../utils/authSession');

const BASE = process.env.TEST_API_URL || 'http://127.0.0.1:5000';

async function authHeaders() {
  const token = generateSessionToken('finance-upload-smoke-test');
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const auth = await authHeaders();
  const { uploadFiles } = genUploader({
    url: `${BASE}/api/uploadthing`,
    fetch: (input, init = {}) =>
      fetch(input, {
        ...init,
        headers: {
          ...(init.headers || {}),
          ...auth,
        },
      }),
  });

  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const file = new File([pdfBytes], 'finance-upload-smoke.pdf', { type: 'application/pdf' });

  try {
    const result = await uploadFiles('financeDocUploader', { files: [file] });
    const uploaded = Array.isArray(result) ? result[0] : result;
    const url = uploaded?.url || uploaded?.ufsUrl;

    if (!url) {
      console.error('Upload failed:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('OK finance upload via /api/uploadthing');
    console.log('url:', url);
    console.log('key:', uploaded.key);
  } catch (err) {
    console.error('FAIL', err.message);
    if (err.cause) console.error('cause:', err.cause);
    if (err.data) console.error('data:', err.data);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FAIL', err.message);
  console.error(err);
  process.exit(1);
});
