/**
 * Integration smoke test: finance upload via UploadThing client route (not server UTApi).
 * Run: node server/scripts/testFinanceUpload.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { genUploader } = require('uploadthing/client');
const { generateSessionToken } = require('../utils/authSession');
const User = require('../models/User');
const Department = require('../models/Department');
const { ADMIN_SLUG } = require('../utils/departmentPermissions');

const BASE = process.env.TEST_API_URL || 'http://127.0.0.1:5000';

async function resolveAdminUserId() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id').lean();
  if (!adminDept) throw new Error('Admin department not found');
  const admin = await User.findOne({ departmentId: adminDept._id }).select('_id').lean();
  if (!admin?._id) throw new Error('Admin user not found');
  return admin._id.toString();
}

async function authHeaders() {
  const userId = await resolveAdminUserId();
  const token = generateSessionToken(userId);
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const auth = await authHeaders();
  const { uploadFiles } = genUploader({
    url: `${BASE}/api/uploadthing`,
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers || undefined);
      Object.entries(auth).forEach(([key, value]) => headers.set(key, value));
      return fetch(input, { ...init, headers });
    },
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
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('FAIL', err.message);
  console.error(err);
  process.exit(1);
});
