import axios from 'axios';

const BATCH_SIZE = 8;

/**
 * Upload chat attachments via server-side UploadThing (same pattern as finance).
 * @param {File[]} files
 * @param {{ onProgress?: (pct: number) => void }} options
 * @returns {Promise<Array<{ url, key, name, size, type }>>}
 */
export async function uploadChatFiles(files, { onProgress } = {}) {
  if (!files?.length) return [];

  const headers = {
    'Content-Type': 'multipart/form-data',
    'x-skip-toast': 'true',
  };

  const uploaded = [];
  const failed = [];
  const total = files.length;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const formData = new FormData();
    batch.forEach((file) => formData.append('files', file));

    const res = await axios.post('/api/chat/upload', formData, {
      headers,
      withCredentials: true,
      timeout: 0,
      onUploadProgress: (event) => {
        if (!event.total || !onProgress) return;
        const batchPct = event.loaded / event.total;
        const overall = ((i + batchPct * batch.length) / total) * 100;
        onProgress(Math.min(99, Math.round(overall)));
      },
    });

    const batchUploaded = res.data?.data || [];
    uploaded.push(...batchUploaded);

    if (res.data?.failed?.length) {
      failed.push(...res.data.failed);
    }

    onProgress?.(Math.min(99, Math.round(((i + batch.length) / total) * 100)));
  }

  onProgress?.(100);

  if (uploaded.length === 0) {
    const msg = failed[0]?.error || failed[0]?.fileName || 'All uploads failed';
    throw new Error(msg);
  }

  if (failed.length > 0) {
    const err = new Error(
      `${uploaded.length} of ${total} uploaded. ${failed.length} failed (e.g. ${failed[0].fileName}).`
    );
    err.partial = true;
    err.uploaded = uploaded;
    err.failed = failed;
    throw err;
  }

  return uploaded;
}
