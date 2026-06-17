import axios from 'axios';
import { uploadFiles } from './uploadthing';

export const FINANCE_DOC_UPLOADER = 'financeDocUploader';
const BATCH_SIZE = 8;

const mapUploadedFile = (uploaded, file) => ({
  url: uploaded.url || uploaded.ufsUrl,
  key: uploaded.key,
  name: uploaded.name || file.name,
  size: uploaded.size || file.size,
  type: file.type || uploaded.type,
});

function formatUploadFailure(payload) {
  const failed = payload?.failed || [];
  const detail = failed[0]?.error;
  const fileName = failed[0]?.fileName;
  if (detail && fileName) return `${fileName}: ${detail}`;
  if (detail) return detail;
  if (fileName) return `Upload failed for ${fileName}`;
  return payload?.message || 'All uploads failed';
}

/**
 * Upload finance files via UploadThing client route (/api/uploadthing).
 * Server-side UTApi uploads fail signature verification in uploadthing v7.
 * @param {File[]} files
 * @param {{ onProgress?: (pct: number) => void }} options
 * @returns {Promise<Array<{ url, key, name, size, type }>>}
 */
export async function uploadFinanceFiles(files, { onProgress } = {}) {
  const list = Array.from(files || []);
  if (!list.length) return [];

  const uploaded = [];
  const failed = [];
  const total = list.length;

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    onProgress?.(Math.min(99, Math.round((i / total) * 100)));

    try {
      const uploadRes = await uploadFiles(FINANCE_DOC_UPLOADER, { files: batch });
      const results = Array.isArray(uploadRes) ? uploadRes : [uploadRes];

      batch.forEach((file, idx) => {
        const item = results[idx];
        const url = item?.url || item?.ufsUrl;
        if (url) {
          uploaded.push(mapUploadedFile(item, file));
        } else {
          failed.push({
            fileName: file.name,
            error: item?.message || item?.code || 'Upload returned no URL',
          });
        }
      });
    } catch (err) {
      let message = err?.message || 'Upload failed';
      if (/middleware|unauthorized|not authorized/i.test(message)) {
        message = 'Session expired or upload not authorized — refresh the page and try again';
      }
      batch.forEach((file) => failed.push({ fileName: file.name, error: message }));
    }

    onProgress?.(Math.min(99, Math.round(((i + batch.length) / total) * 100)));
  }

  onProgress?.(100);

  if (uploaded.length === 0) {
    throw new Error(formatUploadFailure({ failed, message: 'All uploads failed' }));
  }

  if (failed.length > 0) {
    const err = new Error(
      `${uploaded.length} of ${total} uploaded. ${failed.length} failed (e.g. ${failed[0].fileName}: ${failed[0].error || 'unknown error'}).`
    );
    err.partial = true;
    err.uploaded = uploaded;
    err.failed = failed;
    throw err;
  }

  return uploaded;
}

/**
 * Fetch the next finance reference number(s) for a project.
 * @param {string} projectId
 * @param {number} count
 */
export async function fetchNextFinanceReferences(projectId, count = 1) {
  if (!projectId) return [];
  const res = await axios.get('/api/finance/next-reference', {
    params: { project: projectId, count },
    headers: { 'x-skip-toast': 'true' },
    withCredentials: true,
  });
  return res.data?.data?.references || [];
}
