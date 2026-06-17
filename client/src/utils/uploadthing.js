import { generateUploadButton, generateUploadDropzone, generateReactHelpers } from '@uploadthing/react';

const apiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const uploadthingUrl =
  (import.meta.env.VITE_UPLOADTHING_URL || '').trim()
  || (apiBase ? `${apiBase}/api/uploadthing` : '/api/uploadthing');

const resolveRequestUrl = (input) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input?.url) return String(input.url);
  return '';
};

const shouldIncludeCredentials = (requestUrl) => {
  if (requestUrl.includes('ingest.uploadthing.com')) return false;
  if (!requestUrl) return true;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return (
    requestUrl.startsWith('/') ||
    requestUrl.startsWith(apiBase) ||
    requestUrl.includes('/api/uploadthing')
  );
};

const uploadFetch = (input, init = {}) => {
  const requestUrl = resolveRequestUrl(input);
  const includeCredentials = shouldIncludeCredentials(requestUrl);
  return fetch(input, { ...init, ...(includeCredentials ? { credentials: 'include' } : {}) });
};

const UploadButton = generateUploadButton({ url: uploadthingUrl });
const UploadDropzone = generateUploadDropzone({ url: uploadthingUrl });
const { useUploadThing, uploadFiles } = generateReactHelpers({ url: uploadthingUrl, fetch: uploadFetch });

export { UploadButton, UploadDropzone, useUploadThing, uploadFiles };
